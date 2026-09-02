import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBudgetTypeDto } from './dto/create-budget-type.dto';
import { UpdateBudgetTypeDto } from './dto/update-budget-type.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class BudgetTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBudgetTypeDto) {
    return this.prisma.budgetType.create({
      data: dto,
    });
  }

  async findAll(fiscalYear?: number, isActive?: boolean) {
    const where: any = { deletedAt: null };
    if (fiscalYear !== undefined) {
      where.fiscalYear = fiscalYear;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.budgetType.findMany({
      where,
      orderBy: [{ fiscalYear: 'desc' }, { id: 'asc' }],
    });
  }

  async findOne(id: number) {
    const budgetType = await this.prisma.budgetType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!budgetType) {
      throw new NotFoundException(`BudgetType not found with ID: ${id}`);
    }

    return budgetType;
  }

  async update(id: number, dto: UpdateBudgetTypeDto) {
    await this.findOne(id);

    return this.prisma.budgetType.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.budgetType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number) {
    const budgetType = await this.prisma.budgetType.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!budgetType) {
      throw new NotFoundException(
        `Deleted BudgetType not found with ID: ${id} (may not exist or not deleted)`,
      );
    }

    return this.prisma.budgetType.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
