import { Module } from '@nestjs/common';
import { SparePartGroupService } from './spare-part-group.service';
import { SparePartGroupController } from './spare-part-group.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [SparePartGroupController],
  providers: [SparePartGroupService, PrismaService],
  exports: [SparePartGroupService],
})
export class SparePartGroupModule {}
