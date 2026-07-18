import { Test, TestingModule } from '@nestjs/testing';
import { AssetBorrowService } from './asset-borrow.service';
import { PrismaService } from '../prisma.service';
import { UserRole, ReturnCondition, ReturnMethod, DeliveryMethod, RequestSource } from '@prisma/client';
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
    const parcelUser = { id: 'user-id-1', role: UserRole.PARCEL_STAFF };
    const acStaffUser = { id: 'user-id-2', role: UserRole.ASSET_CENTER_STAFF };
    const departmentUser = { id: 'user-id-3', role: UserRole.DEPARTMENT_STAFF };
    const dto = { assetId: 'asset-1', deliveryMethod: DeliveryMethod.PICKUP };

    it('should throw BadRequest if user role is invalid (e.g. MAINTENANCE_STAFF)', async () => {
      const invalidUser = { id: 'user-id-4', role: UserRole.MAINTENANCE_STAFF };
      await expect(service.createBorrow(dto, invalidUser)).rejects.toThrow(BadRequestException);
    });

    it('should ignore dto.borrowerId and use user.id when user is PARCEL_STAFF (Self Service)', async () => {
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 10, code: 'AVAILABLE' });
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 11, code: 'BORROWED' });
      prisma.borrowStatus.findUnique.mockResolvedValueOnce({ id: 20, code: 'BORROWED' });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', availability_status_id: 10 });
      prisma.asset.update.mockResolvedValue({});
      prisma.borrowTransaction.create.mockResolvedValue({ id: 'tx-1', request_source: RequestSource.SELF_SERVICE });

      const dtoOther = { ...dto, borrowerId: 'user-id-99' }; // Client maliciously passes another ID
      await service.createBorrow(dtoOther, parcelUser);

      // Verify it ignored user-id-99 and used parcelUser's own ID
      expect(prisma.borrowTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ borrower_id: 'user-id-1', request_source: RequestSource.SELF_SERVICE }),
        }),
      );
    });

    it('should set request_source = SELF_SERVICE when user is PARCEL_STAFF', async () => {
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 10, code: 'AVAILABLE' });
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 11, code: 'BORROWED' });
      prisma.borrowStatus.findUnique.mockResolvedValueOnce({ id: 20, code: 'BORROWED' });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', availability_status_id: 10 });
      prisma.asset.update.mockResolvedValue({});
      prisma.borrowTransaction.create.mockResolvedValue({ id: 'tx-1', request_source: RequestSource.SELF_SERVICE });

      await service.createBorrow(dto, parcelUser);

      expect(prisma.borrowTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ request_source: RequestSource.SELF_SERVICE }),
        }),
      );
    });

    it('should set request_source = CENTER_SERVICE when user is ASSET_CENTER_STAFF', async () => {
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 10, code: 'AVAILABLE' });
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 11, code: 'BORROWED' });
      prisma.borrowStatus.findUnique.mockResolvedValueOnce({ id: 20, code: 'BORROWED' });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', availability_status_id: 10 });
      prisma.asset.update.mockResolvedValue({});
      prisma.borrowTransaction.create.mockResolvedValue({ id: 'tx-2', request_source: RequestSource.CENTER_SERVICE });

      const dtoForOther = { ...dto, borrowerId: 'user-id-99' };
      await service.createBorrow(dtoForOther, acStaffUser);

      expect(prisma.borrowTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ request_source: RequestSource.CENTER_SERVICE }),
        }),
      );
    });

    it('should throw ConflictException if asset is not AVAILABLE', async () => {
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 10, code: 'AVAILABLE' });
      prisma.availabilityStatus.findUnique.mockResolvedValueOnce({ id: 11, code: 'BORROWED' });
      prisma.borrowStatus.findUnique.mockResolvedValueOnce({ id: 20, code: 'BORROWED' });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', availability_status_id: 11 }); // not AVAILABLE

      await expect(service.createBorrow(dto, parcelUser)).rejects.toThrow(ConflictException);
    });
  });
});
