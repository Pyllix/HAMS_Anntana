import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateBudgetTypeDto } from './dto/create-budget-type.dto';
import { UpdateBudgetTypeDto } from './dto/update-budget-type.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class BudgetTypeService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeName(name: string): string {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Budget type name must not be empty');
    }
    return normalizedName;
  }

  private async ensureNameIsAvailable(name: string, excludeId?: number) {
    const existing = await this.prisma.$queryRaw<Array<{ id: number }>>`
      SELECT budget_type_id AS id
      FROM budget_type
      WHERE deleted_at IS NULL
        AND LOWER(BTRIM(name)) = LOWER(BTRIM(${name}))
        ${excludeId === undefined ? Prisma.empty : Prisma.sql`AND budget_type_id <> ${excludeId}`}
      LIMIT 1
    `;

    if (existing.length > 0) {
      throw new ConflictException('Budget type name already exists');
    }
  }

  private throwIfNameConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Budget type name already exists');
    }
    throw error;
  }

  async create(dto: CreateBudgetTypeDto) {
    const name = this.normalizeName(dto.name);
    await this.ensureNameIsAvailable(name);

    try {
      return await this.prisma.budgetType.create({
        data: { ...dto, name },
      });
    } catch (error) {
      this.throwIfNameConflict(error);
    }
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

    let data = dto;
    if (dto.name !== undefined) {
      const name = this.normalizeName(dto.name);
      await this.ensureNameIsAvailable(name, id);
      data = { ...dto, name };
    }

    try {
      return await this.prisma.budgetType.update({ where: { id }, data });
    } catch (error) {
      this.throwIfNameConflict(error);
    }
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

    const name = this.normalizeName(budgetType.name);
    await this.ensureNameIsAvailable(name, id);

    try {
      return await this.prisma.budgetType.update({
        where: { id },
        data: { name, deletedAt: null },
      });
    } catch (error) {
      this.throwIfNameConflict(error);
    }
  }
}
