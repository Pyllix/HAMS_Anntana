import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { paginate } from 'src/common/utils/paginate.util';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateSparePartGroupDto } from './dto/create-spare-part-group.dto';
import { UpdateSparePartGroupDto } from './dto/update-spare-part-group.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SparePartGroupService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSparePartGroupDto) {
    const existing = await this.prisma.sparepartGroup.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Spare part group "${dto.name}" already exists`);
    }

    return this.prisma.sparepartGroup.create({
      data: {
        name: dto.name,
      },
    });
  }

  async findAll(query?: PaginationDto) {
    const page = query?.page ? Number(query.page) : 1;
    const limit = query?.limit ? Number(query.limit) : 20;
    const search = query?.search?.trim();

    const where: Prisma.SparepartGroupWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            name: { contains: search, mode: 'insensitive' },
          }
        : {}),
    };

    const [groups, total] = await this.prisma.$transaction([
      this.prisma.sparepartGroup.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
        include: {
          _count: {
            select: { spareparts: { where: { deletedAt: null } } },
          },
        },
      }),
      this.prisma.sparepartGroup.count({ where }),
    ]);

    return paginate(groups, total, page, limit);
  }

  async findOne(id: number) {
    const group = await this.prisma.sparepartGroup.findFirst({
      where: { id, deletedAt: null },
      include: {
        spareparts: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Spare part group #${id} not found`);
    }

    return group;
  }

  async update(id: number, dto: UpdateSparePartGroupDto) {
    await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.sparepartGroup.findFirst({
        where: { name: dto.name, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`Spare part group "${dto.name}" already exists`);
      }
    }

    return this.prisma.sparepartGroup.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    const activePartsCount = await this.prisma.sparepart.count({
      where: { groupId: id, deletedAt: null },
    });

    if (activePartsCount > 0) {
      throw new BadRequestException(
        `Cannot delete group #${id} because it still contains ${activePartsCount} active spare parts`,
      );
    }

    return this.prisma.sparepartGroup.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
