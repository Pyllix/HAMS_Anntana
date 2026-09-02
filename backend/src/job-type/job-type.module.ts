import { Module } from '@nestjs/common';
import { JobTypeService } from './job-type.service';
import { JobTypeController } from './job-type.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [JobTypeController],
  providers: [JobTypeService, PrismaService],
  exports: [JobTypeService],
})
export class JobTypeModule {}
