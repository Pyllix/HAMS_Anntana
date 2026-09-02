import { Module } from '@nestjs/common';
import { EquipmentTypeService } from './equipment-type.service';
import { EquipmentTypeController } from './equipment-type.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [EquipmentTypeController],
  providers: [EquipmentTypeService, PrismaService],
  exports: [EquipmentTypeService],
})
export class EquipmentTypeModule {}
