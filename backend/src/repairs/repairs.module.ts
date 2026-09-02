import { Module } from '@nestjs/common';
import { RepairsService } from './repairs.service';
import { RepairsController } from './repairs.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [RepairsController],
  providers: [RepairsService, PrismaService],
  exports: [RepairsService],
})
export class RepairsModule {}
