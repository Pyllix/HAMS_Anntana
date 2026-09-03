import { Module } from '@nestjs/common';
import { AcqTypeService } from './acq-type.service';
import { AcqTypeController } from './acq-type.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [AcqTypeController],
  providers: [AcqTypeService, PrismaService],
  exports: [AcqTypeService],
})
export class AcqTypeModule {}
