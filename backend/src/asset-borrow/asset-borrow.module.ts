import { Module } from '@nestjs/common';
import { AssetBorrowService } from './asset-borrow.service';
import { AssetBorrowController } from './asset-borrow.controller';
import { PrismaService } from '../prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  BorrowDeadlineNotificationsService,
  BORROW_DEADLINE_CLOCK,
} from './borrow-deadline-notifications.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AssetBorrowController],
  providers: [
    AssetBorrowService,
    BorrowDeadlineNotificationsService,
    PrismaService,
    { provide: BORROW_DEADLINE_CLOCK, useValue: { now: () => new Date() } },
  ],
})
export class AssetBorrowModule {}
