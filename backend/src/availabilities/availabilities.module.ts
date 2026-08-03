import { Module } from '@nestjs/common';
import { AvailabilitiesService } from './availabilities.service';
import { AvailabilitiesController } from './availabilities.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [AvailabilitiesController],
  providers: [AvailabilitiesService, PrismaService],
})
export class AvailabilitiesModule {}
