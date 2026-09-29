import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateAcqTypeDto } from './dto/create-acq-type.dto';
import { UpdateAcqTypeDto } from './dto/update-acq-type.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AcqTypeService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeName(name: string): string {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Acquisition type name must not be empty');
    }
    return normalizedName;
  }

  private async ensureNameIsAvailable(name: string, excludeId?: number) {
    const existing = await this.prisma.$queryRaw<Array<{ id: number }>>`
      SELECT acq_type_id AS id
      FROM acq_type
      WHERE deleted_at IS NULL
        AND LOWER(BTRIM(acq_type_name)) = LOWER(BTRIM(${name}))
        ${excludeId === undefined ? Prisma.empty : Prisma.sql`AND acq_type_id <> ${excludeId}`}
      LIMIT 1
    `;

    if (existing.length > 0) {
      throw new ConflictException('Acquisition type name already exists');
    }
  }

  private throwIfNameConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Acquisition type name already exists');
    }
    throw error;
  }

  async create(dto: CreateAcqTypeDto) {
    const name = this.normalizeName(dto.name);
    await this.ensureNameIsAvailable(name);

    try {
      return await this.prisma.acqType.create({
        data: { ...dto, name },
      });
    } catch (error) {
      this.throwIfNameConflict(error);
    }
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

    let data = dto;
    if (dto.name !== undefined) {
      const name = this.normalizeName(dto.name);
      await this.ensureNameIsAvailable(name, id);
      data = { ...dto, name };
    }

    try {
      return await this.prisma.acqType.update({ where: { id }, data });
    } catch (error) {
      this.throwIfNameConflict(error);
    }
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

    const name = this.normalizeName(acqType.name);
    await this.ensureNameIsAvailable(name, id);

    try {
      return await this.prisma.acqType.update({
        where: { id },
        data: { name, deletedAt: null },
      });
    } catch (error) {
      this.throwIfNameConflict(error);
    }
  }
}
