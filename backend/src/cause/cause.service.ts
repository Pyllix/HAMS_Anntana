import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCauseDto } from './dto/create-cause.dto';
import { UpdateCauseDto } from './dto/update-cause.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class CauseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCauseDto) {
    const existing = await this.prisma.cause.findFirst({
      where: { code: dto.code, deleteAt: null },
    });
    if (existing) {
      throw new ConflictException(`Cause with code "${dto.code}" already exists`);
    }

    return this.prisma.cause.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.cause.findMany({
      where: { deleteAt: null },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: number) {
    const cause = await this.prisma.cause.findFirst({
      where: { id, deleteAt: null },
    });

    if (!cause) {
      throw new NotFoundException(`Cause not found with ID: ${id}`);
    }

    return cause;
  }

  async update(id: number, dto: UpdateCauseDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.cause.findFirst({
        where: { code: dto.code, id: { not: id }, deleteAt: null },
      });
      if (existing) {
        throw new ConflictException(`Cause with code "${dto.code}" already exists`);
      }
    }

    return this.prisma.cause.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.cause.update({
      where: { id },
      data: { deleteAt: new Date() },
    });
  }

  async restore(id: number) {
    const cause = await this.prisma.cause.findFirst({
      where: { id, deleteAt: { not: null } },
    });

    if (!cause) {
      throw new NotFoundException(
        `Deleted Cause not found with ID: ${id} (may not exist or not deleted)`,
      );
    }

    return this.prisma.cause.update({
      where: { id },
      data: { deleteAt: null },
    });
  }
}
