import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AvailabilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAvailabilityDto) {
    const existingStatus = await this.prisma.availabilityStatus.findUnique({
      where: { code: dto.code },
    });
    if (existingStatus) {
      throw new ConflictException('Availability status code already exists');
    }

    return this.prisma.availabilityStatus.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.availabilityStatus.findMany({
      where: { deletedAt: null },
      omit: { deletedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const availabilityStatus = await this.prisma.availabilityStatus.findFirst({
      where: { id, deletedAt: null },
    });

    if (!availabilityStatus) {
      throw new NotFoundException(`AvailabilityStatus not found with ID: ${id}`);
    }

    return availabilityStatus;
  }

  async update(id: number, dto: UpdateAvailabilityDto) {
    await this.findOne(id); // Ensure it exists

    return this.prisma.availabilityStatus.update({
      where: { id },
      data: dto,
      omit: { deletedAt: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Ensure it exists

    return this.prisma.availabilityStatus.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number) {
    const availabilityStatus = await this.prisma.availabilityStatus.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!availabilityStatus) {
      throw new NotFoundException(
        `Deleted AvailabilityStatus not found with ID: ${id} (may not exist or not deleted)`,
      );
    }

    return this.prisma.availabilityStatus.update({
      where: { id },
      data: { deletedAt: null },
      omit: { deletedAt: true },
    });
  }
}
