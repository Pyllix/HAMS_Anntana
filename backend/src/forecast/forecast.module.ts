import { Module } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { ForecastController } from './forecast.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [ForecastController],
  providers: [ForecastService, PrismaService],
  exports: [ForecastService],
})
export class ForecastModule {}

