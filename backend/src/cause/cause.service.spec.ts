import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CauseService } from './cause.service';
import { PrismaService } from 'src/prisma.service';

describe('CauseService', () => {
  let service: CauseService;
  let prisma: PrismaService;

  const mockPrisma = {
    cause: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CauseService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CauseService>(CauseService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a repair cause', async () => {
    const dto = { code: '01', name: 'การเสื่อมสภาพตามอายุการใช้งาน' };
    mockPrisma.cause.findFirst.mockResolvedValue(null);
    mockPrisma.cause.create.mockResolvedValue({ id: 1, ...dto });

    const result = await service.create(dto);
    expect(result).toEqual({ id: 1, ...dto });
  });

  it('should throw ConflictException if cause code already exists', async () => {
    const dto = { code: '01', name: 'การเสื่อมสภาพตามอายุการใช้งาน' };
    mockPrisma.cause.findFirst.mockResolvedValue({ id: 1, ...dto });

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('should soft delete a repair cause', async () => {
    mockPrisma.cause.findFirst.mockResolvedValue({ id: 1, code: '01' });
    mockPrisma.cause.update.mockResolvedValue({ id: 1, deleteAt: new Date() });

    await service.remove(1);
    expect(mockPrisma.cause.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deleteAt: expect.any(Date) },
    });
  });

  it('should restore a soft-deleted repair cause', async () => {
    mockPrisma.cause.findFirst.mockResolvedValue({ id: 1, deleteAt: new Date() });
    mockPrisma.cause.update.mockResolvedValue({ id: 1, deleteAt: null });

    const result = await service.restore(1);
    expect(result.deleteAt).toBeNull();
  });
});
