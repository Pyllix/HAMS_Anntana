import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SessionLifetimeService } from '../auth/session-lifetime.service';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationStreamService,
    PrismaService,
    SessionLifetimeService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
