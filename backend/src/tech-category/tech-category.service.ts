import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTechCategoryDto } from './dto/create-tech-category.dto';
import { UpdateTechCategoryDto } from './dto/update-tech-category.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class TechCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTechCategoryDto) {
    const existing = await this.prisma.techCategory.findFirst({
      where: { code: dto.code, deleteAt: null },
    });
    if (existing) {
      throw new ConflictException(`TechCategory with code "${dto.code}" already exists`);
    }

    return this.prisma.techCategory.create({
      data: dto,
    });
  }

  async findAll(isActive?: boolean) {
    const where: any = { deleteAt: null };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.techCategory.findMany({
      where,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const techCategory = await this.prisma.techCategory.findFirst({
      where: { id, deleteAt: null },
    });

    if (!techCategory) {
      throw new NotFoundException(`TechCategory not found with ID: ${id}`);
    }

    return techCategory;
  }

  async update(id: number, dto: UpdateTechCategoryDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.techCategory.findFirst({
        where: { code: dto.code, id: { not: id }, deleteAt: null },
      });
      if (existing) {
        throw new ConflictException(`TechCategory with code "${dto.code}" already exists`);
      }
    }

    return this.prisma.techCategory.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.techCategory.update({
      where: { id },
      data: { deleteAt: new Date() },
    });
  }

  async restore(id: number) {
    const techCategory = await this.prisma.techCategory.findFirst({
      where: { id, deleteAt: { not: null } },
    });

    if (!techCategory) {
      throw new NotFoundException(
        `Deleted TechCategory not found with ID: ${id} (may not exist or not deleted)`,
      );
    }

    return this.prisma.techCategory.update({
      where: { id },
      data: { deleteAt: null },
    });
  }
}
