import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { PrismaService } from '../prisma.service';
import { SessionLifetimeService } from '../auth/session-lifetime.service';
import { NotificationResponseDto } from './dto/notification-response.dto';

const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_PENDING_EVENTS = 100;

interface StreamConnection {
  readonly userId: string;
  readonly sessionToken: string;
  readonly subscriber: Subscriber<MessageEvent>;
  readonly pendingEvents: MessageEvent[];
  readonly abortTransport: () => void;
  heartbeat?: NodeJS.Timeout;
  processing: boolean;
  closed: boolean;
}

@Injectable()
export class NotificationStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationStreamService.name);
  private readonly connectionsByUser = new Map<string, Set<StreamConnection>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionLifetime: SessionLifetimeService,
  ) {}

  connect(
    userId: string,
    sessionToken: string,
    abortTransport: () => void,
    lastEventId?: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const connection: StreamConnection = {
        userId,
        sessionToken,
        subscriber,
        pendingEvents: [],
        abortTransport,
        processing: false,
        closed: false,
      };

      let userConnections = this.connectionsByUser.get(userId);
      if (!userConnections) {
        userConnections = new Set<StreamConnection>();
        this.connectionsByUser.set(userId, userConnections);
      }
      userConnections.add(connection);

      const reason = lastEventId ? 'reconnected' : 'connected';
      this.enqueue(connection, {
        type: 'notifications.sync_required',
        data: { reason },
      });
      connection.heartbeat = setInterval(() => {
        if (connection.processing || connection.pendingEvents.length > 0) {
          return;
        }
        this.enqueue(connection, { type: 'heartbeat', data: {} });
      }, HEARTBEAT_INTERVAL_MS);

      return () => this.removeConnection(connection);
    });
  }

  publishCreated(userId: string, notification: NotificationResponseDto): void {
    const connections = this.connectionsByUser.get(userId);
    if (!connections) return;

    const event: MessageEvent = {
      id: notification.id,
      type: 'notification.created',
      data: notification,
    };
    for (const connection of connections) {
      this.enqueue(connection, event);
    }
  }

  onModuleDestroy(): void {
    for (const connections of this.connectionsByUser.values()) {
      for (const connection of [...connections]) {
        this.terminate(connection);
      }
    }
    this.connectionsByUser.clear();
  }

  private enqueue(connection: StreamConnection, event: MessageEvent): void {
    if (connection.closed || connection.subscriber.closed) return;
    if (connection.pendingEvents.length >= MAX_PENDING_EVENTS) {
      this.terminate(connection);
      return;
    }
    connection.pendingEvents.push(event);
    void this.drain(connection);
  }

  private async drain(connection: StreamConnection): Promise<void> {
    if (connection.processing || connection.closed) return;
    connection.processing = true;

    try {
      while (connection.pendingEvents.length > 0 && !connection.closed) {
        const authorized = await this.isAuthorized(connection);
        if (!authorized) {
          this.terminate(connection);
          return;
        }

        const event = connection.pendingEvents.shift();
        if (event) connection.subscriber.next(event);
      }
    } catch (error) {
      this.logger.warn(
        `Closing notification stream after authorization check failed (${error instanceof Error ? error.name : 'unknown error'})`,
      );
      this.terminate(connection);
    } finally {
      connection.processing = false;
    }
  }

  private async isAuthorized(connection: StreamConnection): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { token: connection.sessionToken },
      select: {
        userId: true,
        user: { select: { deletedAt: true, banned: true } },
      },
    });
    if (
      !session ||
      session.userId !== connection.userId ||
      session.user.deletedAt !== null ||
      session.user.banned === true
    ) {
      return false;
    }

    return (
      (await this.sessionLifetime.enforceSession(
        connection.sessionToken,
        false,
      )) !== null
    );
  }

  private terminate(connection: StreamConnection): void {
    if (connection.closed) return;
    this.removeConnection(connection);
    try {
      connection.abortTransport();
    } catch (error) {
      this.logger.warn(
        `Could not abort notification transport (${error instanceof Error ? error.name : 'unknown error'})`,
      );
    }
    connection.subscriber.complete();
  }

  private removeConnection(connection: StreamConnection): void {
    if (connection.closed) return;
    connection.closed = true;
    connection.pendingEvents.length = 0;
    if (connection.heartbeat) clearInterval(connection.heartbeat);

    const connections = this.connectionsByUser.get(connection.userId);
    connections?.delete(connection);
    if (connections?.size === 0) {
      this.connectionsByUser.delete(connection.userId);
    }
  }
}
