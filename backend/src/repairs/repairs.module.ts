import { Module } from '@nestjs/common';
import { RepairsService } from './repairs.service';
import { RepairsController } from './repairs.controller';
import { PrismaService } from 'src/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [RepairsController],
  providers: [RepairsService, PrismaService],
  exports: [RepairsService],
})
export class RepairsModule {}
