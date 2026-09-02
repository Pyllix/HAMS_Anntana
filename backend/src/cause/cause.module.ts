import { Module } from '@nestjs/common';
import { CauseService } from './cause.service';
import { CauseController } from './cause.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [CauseController],
  providers: [CauseService, PrismaService],
  exports: [CauseService],
})
export class CauseModule {}
