import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateCompanyDto) {
    const existingCompany = await this.prisma.company.findUnique({
      where: { code: dto.code },
    });
    if (existingCompany) {
      throw new ConflictException('Company code already exists');
    }

    const company = await this.prisma.company.create({
      data: dto,
    });

    return company;
  }

  async findAll() {
    return await this.prisma.company.findMany({
      where: { deletedAt: null },
      omit: { deletedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        tel: true,
        address: true,
        fax: true,
        group: true,
        remark: true,
      },
    });
    if (!company) {
      throw new NotFoundException(`Company not found with ID: ${id}`);
    }
    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    await this.findOne(id);

    return this.prisma.company.update({
      where: { id },
      data: updateCompanyDto,
      omit: { deletedAt: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!company) {
      throw new NotFoundException(
        `Deleted company not found with ID: ${id} (may not exist or not deleted)`,
      );
    }
    return this.prisma.company.update({
      where: { id },
      data: { deletedAt: null },
      omit: { deletedAt: true },
    });
  }
}
