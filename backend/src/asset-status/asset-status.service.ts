import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAssetStatusDto } from './dto/create-asset-status.dto';
import { UpdateAssetStatusDto } from './dto/update-asset-status.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AssetStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAssetStatusDto) {
    const existingStatus = await this.prisma.assetStatus.findUnique({
      where: { code: dto.code },
    });
    if (existingStatus) {
      throw new ConflictException('Asset status code already exists');
    }

    return this.prisma.assetStatus.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.assetStatus.findMany({
      where: { deletedAt: null },
      omit: { deletedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const assetStatus = await this.prisma.assetStatus.findFirst({
      where: { id, deletedAt: null },
    });

    if (!assetStatus) {
      throw new NotFoundException(`AssetStatus not found with ID: ${id}`);
    }

    return assetStatus;
  }

  async update(id: number, dto: UpdateAssetStatusDto) {
    await this.findOne(id); // Ensure it exists

    return this.prisma.assetStatus.update({
      where: { id },
      data: dto,
      omit: { deletedAt: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Ensure it exists

    return this.prisma.assetStatus.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number) {
    const assetStatus = await this.prisma.assetStatus.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!assetStatus) {
      throw new NotFoundException(
        `Deleted AssetStatus not found with ID: ${id} (may not exist or not deleted)`,
      );
    }

    return this.prisma.assetStatus.update({
      where: { id },
      data: { deletedAt: null },
      omit: { deletedAt: true },
    });
  }
}
