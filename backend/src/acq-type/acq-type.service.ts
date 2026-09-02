import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAcqTypeDto } from './dto/create-acq-type.dto';
import { UpdateAcqTypeDto } from './dto/update-acq-type.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AcqTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAcqTypeDto) {
    return this.prisma.acqType.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.acqType.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const acqType = await this.prisma.acqType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!acqType) {
      throw new NotFoundException(`AcqType not found with ID: ${id}`);
    }

    return acqType;
  }

  async update(id: number, dto: UpdateAcqTypeDto) {
    await this.findOne(id);

    return this.prisma.acqType.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.acqType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number) {
    const acqType = await this.prisma.acqType.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!acqType) {
      throw new NotFoundException(
        `Deleted AcqType not found with ID: ${id} (may not exist or not deleted)`,
      );
    }

    return this.prisma.acqType.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
