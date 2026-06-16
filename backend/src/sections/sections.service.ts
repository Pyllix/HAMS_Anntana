import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(createSectionDto: CreateSectionDto) {
    return this.prisma.section.create({ data: createSectionDto });
  }

  // ─── Read All ───────────────────────────────────────────────────────────────

  async findAll() {
    return this.prisma.section.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // ─── Read One ───────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const section = await this.prisma.section.findUnique({ where: { id } });
    if (!section) {
      throw new NotFoundException(`Section not found with ID: ${id}`);
    }
    return section;
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  async update(id: string, updateSectionDto: UpdateSectionDto) {
    await this.findOne(id); // throws NotFoundException if not found
    return this.prisma.section.update({ where: { id }, data: updateSectionDto });
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async remove(id: string) {
    await this.findOne(id); // throws NotFoundException if not found
    await this.prisma.section.delete({ where: { id } });
    return { message: `Section ID: ${id} successfully deleted` };
  }
}
