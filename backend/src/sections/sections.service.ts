import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) { }

  // ─── Create ──────────────────────────────────────────────────────────────────

  // Create a new section 
  async create(dto: CreateSectionDto) {
    // Check if section code already exists
    const existingSection = await this.prisma.section.findUnique({
      where: { code: dto.code },
    });

    if (existingSection) {
      throw new ConflictException('Section code already exists');
    }

    // Create the new section
    const section = await this.prisma.section.create({
      data: dto,
    });

    return section;
  }

  async findAll() {
    return this.prisma.section.findMany({
      where: { deletedAt: null },
      omit: { deletedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const section = await this.prisma.section.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        tel: true,
        building: true,
      },
    });

    if (!section) {
      throw new NotFoundException(`Section not found with ID: ${id}`);
    }

    return section;
  }

  async update(id: number, updateSectionDto: UpdateSectionDto) {
    return `This action updates a #${id} section`;
  }

  remove(id: number) {
    return `This action removes a #${id} section`;
  }

  restore(id: number) {
    return `This action restore a #${id} section`
  }
}
