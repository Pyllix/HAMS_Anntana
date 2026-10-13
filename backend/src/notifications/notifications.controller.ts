import {
  Controller,
  Get,
  Header,
  MessageEvent,
  Query,
  Req,
  Res,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { readSessionToken } from '../auth/auth-cookies';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';
import { NotificationStreamService } from './notification-stream.service';
import type { PaginatedResult } from '../common/utils/paginate.util';

interface AuthenticatedNotificationSession {
  user: { id: string };
}

@ApiTags('Notifications')
@ApiCookieAuth()
@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly stream: NotificationStreamService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List notifications for the signed-in user' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated notification history' })
  findAll(
    @Query() query: QueryNotificationsDto,
    @Session() session: AuthenticatedNotificationSession,
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    return this.notifications.findForUser(session.user.id, query);
  }

  @Get('unread-count')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Count unread notifications for the signed-in user',
  })
  @ApiResponse({ status: 200, description: 'Unread notification count' })
  countUnread(
    @Session() session: AuthenticatedNotificationSession,
  ): Promise<{ count: number }> {
    return this.notifications.countUnreadForUser(session.user.id);
  }

  @Sse('stream')
  @ApiOperation({
    summary: 'Stream new notifications using Server-Sent Events',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated notification stream',
  })
  streamNotifications(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Session() session: AuthenticatedNotificationSession,
  ): Observable<MessageEvent> {
    const sessionToken = readSessionToken(request);
    if (!sessionToken) {
      throw new UnauthorizedException('A session cookie is required');
    }

    const lastEventId = request.get('Last-Event-ID');
    return this.stream.connect(
      session.user.id,
      sessionToken,
      () => response.destroy(),
      lastEventId,
    );
  }
}
