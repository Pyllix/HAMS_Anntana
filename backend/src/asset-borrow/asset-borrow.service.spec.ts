import { Test, TestingModule } from '@nestjs/testing';
import { AssetBorrowService } from './asset-borrow.service';
import { PrismaService } from '../prisma.service';
import { UserRole, ReturnCondition, ReturnMethod } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  $transaction: jest.fn(),
  asset: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  borrowTransaction: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  availabilityStatus: {
    findUnique: jest.fn(),
  },
  borrowStatus: {
    findUnique: jest.fn(),
  },
  assetStatus: {
    findUnique: jest.fn(),
  }
};

describe('AssetBorrowService', () => {
  let service: AssetBorrowService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetBorrowService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AssetBorrowService>(AssetBorrowService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBorrow', () => {
    const user = { sub: 'user-id-1', role: UserRole.DEPARTMENT_STAFF };
    const dto = { assetId: 'asset-1', returnMethod: ReturnMethod.self_return };

    it('should throw BadRequest if non-AC staff tries to borrow for someone else', async () => {
      const dtoOther = { ...dto, borrowerId: 'user-id-2' };
      await expect(service.createBorrow(dtoOther, user)).rejects.toThrow(BadRequestException);
    });

    it('should successfully create borrow transaction if asset is AVAILABLE', async () => {
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 10, code: 'AVAILABLE' });
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 11, code: 'BORROWED' });
      prisma.borrowStatus.findUnique.mockResolvedValueOnce({ id: 20, code: 'BORROWED' });
      
      prisma.$transaction.mockImplementation(async (cb: any) => {
        return cb(prisma);
      });

      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', availability_status_id: 10 });
      prisma.asset.update.mockResolvedValue({ id: 'asset-1', availability_status_id: 11 });
      prisma.borrowTransaction.create.mockResolvedValue({ id: 'tx-1', asset_id: 'asset-1', borrow_status_id: 20 });

      const result = await service.createBorrow(dto, user);
      
      expect(result).toBeDefined();
      expect(prisma.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
        data: { availability_status_id: 11 }
      });
    });

    it('should throw ConflictException if asset is not AVAILABLE', async () => {
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 10, code: 'AVAILABLE' });
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 11, code: 'BORROWED' });
      prisma.borrowStatus.findUnique.mockResolvedValueOnce({ id: 20, code: 'BORROWED' });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        return cb(prisma);
      });

      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', availability_status_id: 11 }); // not 10

      await expect(service.createBorrow(dto, user)).rejects.toThrow(ConflictException);
    });
  });
});
