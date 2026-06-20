import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAssetDto: CreateAssetDto, userId: string) {
    return this.prisma.asset.create({
      data: {
        ...createAssetDto,
        created_by: userId,
        updated_by: userId,
      } as any, // Using 'as any' since CreateAssetDto might not have all fields yet
    });
  }

  async findAll() {
    return this.prisma.asset.findMany();
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });
    if (!asset) {
      throw new NotFoundException(`Asset #${id} not found`);
    }
    return asset;
  }

  async update(id: string, updateAssetDto: UpdateAssetDto, userId: string) {
    await this.findOne(id); // Check if exists
    return this.prisma.asset.update({
      where: { id },
      data: {
        ...updateAssetDto,
        updated_by: userId,
      } as any,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    // Usually remove is a soft delete or hard delete. If hard delete, no need to update updated_by.
    // Assuming hard delete since no deleted_at in asset.prisma.
    return this.prisma.asset.delete({
      where: { id },
    });
  }
}
