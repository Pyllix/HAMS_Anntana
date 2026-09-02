import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateJobTypeDto } from './dto/create-job-type.dto';
import { UpdateJobTypeDto } from './dto/update-job-type.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class JobTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateJobTypeDto) {
    return this.prisma.jobType.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.jobType.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const jobType = await this.prisma.jobType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!jobType) {
      throw new NotFoundException(`JobType not found with ID: ${id}`);
    }

    return jobType;
  }

  async update(id: number, dto: UpdateJobTypeDto) {
    await this.findOne(id);

    return this.prisma.jobType.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.jobType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number) {
    const jobType = await this.prisma.jobType.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!jobType) {
      throw new NotFoundException(
        `Deleted JobType not found with ID: ${id} (may not exist or not deleted)`,
      );
    }

    return this.prisma.jobType.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
