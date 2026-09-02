import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateEquipmentTypeDto } from './dto/create-equipment-type.dto';
import { UpdateEquipmentTypeDto } from './dto/update-equipment-type.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class EquipmentTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEquipmentTypeDto) {
    return this.prisma.equipmentType.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.equipmentType.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const equipmentType = await this.prisma.equipmentType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    if (!equipmentType) {
      throw new NotFoundException(`EquipmentType not found with ID: ${id}`);
    }

    return equipmentType;
  }

  async update(id: number, dto: UpdateEquipmentTypeDto) {
    await this.findOne(id);

    return this.prisma.equipmentType.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    const equipmentType = await this.findOne(id);

    if (equipmentType._count && equipmentType._count.assets > 0) {
      throw new BadRequestException(
        `Cannot delete EquipmentType #${id} because it is currently assigned to ${equipmentType._count.assets} asset(s)`,
      );
    }

    return this.prisma.equipmentType.delete({
      where: { id },
    });
  }
}
