import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobTypeService } from './job-type.service';
import { PrismaService } from 'src/prisma.service';

describe('JobTypeService', () => {
  let service: JobTypeService;
  let prisma: PrismaService;

  const mockPrisma = {
    jobType: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobTypeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<JobTypeService>(JobTypeService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a job type', async () => {
    const dto = { name: 'ตรวจเช็คและซ่อมทั่วไป' };
    mockPrisma.jobType.create.mockResolvedValue({ id: 1, ...dto });

    const result = await service.create(dto);
    expect(result).toEqual({ id: 1, ...dto });
  });

  it('should return all job types', async () => {
    mockPrisma.jobType.findMany.mockResolvedValue([{ id: 1, name: 'ตรวจเช็คและซ่อมทั่วไป' }]);

    const result = await service.findAll();
    expect(result).toEqual([{ id: 1, name: 'ตรวจเช็คและซ่อมทั่วไป' }]);
  });

  it('should soft delete a job type', async () => {
    mockPrisma.jobType.findFirst.mockResolvedValue({ id: 1, name: 'ตรวจเช็คและซ่อมทั่วไป' });
    mockPrisma.jobType.update.mockResolvedValue({ id: 1, deletedAt: new Date() });

    await service.remove(1);
    expect(mockPrisma.jobType.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should restore a soft-deleted job type', async () => {
    mockPrisma.jobType.findFirst.mockResolvedValue({ id: 1, deletedAt: new Date() });
    mockPrisma.jobType.update.mockResolvedValue({ id: 1, deletedAt: null });

    const result = await service.restore(1);
    expect(result.deletedAt).toBeNull();
  });
});
