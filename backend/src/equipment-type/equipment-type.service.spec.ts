import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EquipmentTypeService } from './equipment-type.service';
import { PrismaService } from 'src/prisma.service';

describe('EquipmentTypeService', () => {
  let service: EquipmentTypeService;
  let prisma: PrismaService;

  const mockPrisma = {
    equipmentType: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentTypeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EquipmentTypeService>(EquipmentTypeService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an equipment type', async () => {
    const dto = { name: 'เครื่องช่วยชีวิต' };
    mockPrisma.equipmentType.create.mockResolvedValue({ id: 1, ...dto });

    const result = await service.create(dto);
    expect(result).toEqual({ id: 1, ...dto });
  });

  it('should return all equipment types', async () => {
    mockPrisma.equipmentType.findMany.mockResolvedValue([{ id: 1, name: 'เครื่องช่วยชีวิต' }]);

    const result = await service.findAll();
    expect(result).toEqual([{ id: 1, name: 'เครื่องช่วยชีวิต' }]);
  });

  it('should delete equipment type if no assets are attached', async () => {
    mockPrisma.equipmentType.findUnique.mockResolvedValue({ id: 1, name: 'เครื่องช่วยชีวิต', _count: { assets: 0 } });
    mockPrisma.equipmentType.delete.mockResolvedValue({ id: 1 });

    await service.remove(1);
    expect(mockPrisma.equipmentType.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('should throw BadRequestException on delete if assets are attached', async () => {
    mockPrisma.equipmentType.findUnique.mockResolvedValue({ id: 1, name: 'เครื่องช่วยชีวิต', _count: { assets: 3 } });

    await expect(service.remove(1)).rejects.toThrow(BadRequestException);
  });
});
