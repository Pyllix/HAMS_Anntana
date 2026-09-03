import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TechCategoryService } from './tech-category.service';
import { PrismaService } from 'src/prisma.service';

describe('TechCategoryService', () => {
  let service: TechCategoryService;
  let prisma: PrismaService;

  const mockPrisma = {
    techCategory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TechCategoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TechCategoryService>(TechCategoryService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a tech category', async () => {
    const dto = { code: 'AIR_CON', name: 'งานเครื่องปรับอากาศ' };
    mockPrisma.techCategory.findFirst.mockResolvedValue(null);
    mockPrisma.techCategory.create.mockResolvedValue({ id: 1, ...dto });

    const result = await service.create(dto);
    expect(result).toEqual({ id: 1, ...dto });
  });

  it('should throw ConflictException if tech category code already exists', async () => {
    const dto = { code: 'AIR_CON', name: 'งานเครื่องปรับอากาศ' };
    mockPrisma.techCategory.findFirst.mockResolvedValue({ id: 1, ...dto });

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('should soft delete a tech category', async () => {
    mockPrisma.techCategory.findFirst.mockResolvedValue({ id: 1, code: 'AIR_CON' });
    mockPrisma.techCategory.update.mockResolvedValue({ id: 1, deleteAt: new Date() });

    await service.remove(1);
    expect(mockPrisma.techCategory.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deleteAt: expect.any(Date) },
    });
  });

  it('should restore a soft-deleted tech category', async () => {
    mockPrisma.techCategory.findFirst.mockResolvedValue({ id: 1, deleteAt: new Date() });
    mockPrisma.techCategory.update.mockResolvedValue({ id: 1, deleteAt: null });

    const result = await service.restore(1);
    expect(result.deleteAt).toBeNull();
  });
});
