import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAssetTypeDto } from './dto/create-asset-type.dto';
import { UpdateAssetTypeDto } from './dto/update-asset-type.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AssetTypeService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateAssetTypeDto) {
    return this.prisma.assetType.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.assetType.findMany({
      where: { deletedAt: null },
      omit: { deletedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const assetType = await this.prisma.assetType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!assetType) {
      throw new NotFoundException(`AssetType not found with ID: ${id}`);
    }

    return assetType;
  }

  async update(id: number, dto: UpdateAssetTypeDto) {
    await this.findOne(id); // Ensure it exists

    return this.prisma.assetType.update({
      where: { id },
      data: dto,
      omit: { deletedAt: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Ensure it exists

    return this.prisma.assetType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number) {
    const assetType = await this.prisma.assetType.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!assetType) {
      throw new NotFoundException(
        `Deleted AssetType not found with ID: ${id} (may not exist or not deleted)`,
      );
    }

    return this.prisma.assetType.update({
      where: { id },
      data: { deletedAt: null },
      omit: { deletedAt: true },
    });
  }
}
