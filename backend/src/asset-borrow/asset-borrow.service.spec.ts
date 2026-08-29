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
  },
  user: {
    findFirst: jest.fn(),
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

    it('should ignore dto.borrowerId, use user.id, set PENDING_APPROVAL and RESERVED when user is PARCEL_STAFF (Self Service)', async () => {
      prisma.availabilityStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'AVAILABLE') return { id: 10, code: 'AVAILABLE' };
        if (where.code === 'RESERVED') return { id: 12, code: 'RESERVED' };
        return { id: 11, code: 'BORROWED' };
      });
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVAL') return { id: 21, code: 'PENDING_APPROVAL' };
        return { id: 20, code: 'BORROWED' };
      });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', availability_status_id: 10 });
      prisma.asset.update.mockResolvedValue({});
      prisma.borrowTransaction.create.mockResolvedValue({ id: 'tx-1', request_source: RequestSource.SELF_SERVICE });

      const dtoOther = { ...dto, borrowerId: 'user-id-99' }; // Client passes another ID
      await service.createBorrow(dtoOther, parcelUser);

      // Verify it ignored user-id-99 and used parcelUser's own ID with RESERVED / PENDING_APPROVAL
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: { availability_status_id: 12 },
        }),
      );
      expect(prisma.borrowTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            borrower_id: 'user-id-1',
            borrow_status_id: 21,
            request_source: RequestSource.SELF_SERVICE,
          }),
        }),
      );
    });

    it('should set request_source = CENTER_SERVICE and BORROWED when user is ASSET_CENTER_STAFF', async () => {
      prisma.availabilityStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'AVAILABLE') return { id: 10, code: 'AVAILABLE' };
        if (where.code === 'RESERVED') return { id: 12, code: 'RESERVED' };
        return { id: 11, code: 'BORROWED' };
      });
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVAL') return { id: 21, code: 'PENDING_APPROVAL' };
        return { id: 20, code: 'BORROWED' };
      });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', availability_status_id: 10 });
      prisma.user.findFirst.mockResolvedValue({ id: 'user-id-99' });
      prisma.asset.update.mockResolvedValue({});
      prisma.borrowTransaction.create.mockResolvedValue({ id: 'tx-2', request_source: RequestSource.CENTER_SERVICE });

      const dtoForOther = { ...dto, borrowerId: 'user-id-99' };
      await service.createBorrow(dtoForOther, acStaffUser);

      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: { availability_status_id: 11 },
        }),
      );
      expect(prisma.borrowTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            borrower_id: 'user-id-99',
            borrow_status_id: 20,
            request_source: RequestSource.CENTER_SERVICE,
          }),
        }),
      );
    });

    it('should throw ConflictException if asset is not AVAILABLE', async () => {
      prisma.availabilityStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'AVAILABLE') return { id: 10, code: 'AVAILABLE' };
        if (where.code === 'RESERVED') return { id: 12, code: 'RESERVED' };
        return { id: 11, code: 'BORROWED' };
      });
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVAL') return { id: 21, code: 'PENDING_APPROVAL' };
        return { id: 20, code: 'BORROWED' };
      });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', availability_status_id: 11 }); // not AVAILABLE

      await expect(service.createBorrow(dto, parcelUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('approveBorrow', () => {
    const acStaffUser = { id: 'user-id-2', role: UserRole.ASSET_CENTER_STAFF };

    it('should approve transaction in PENDING_APPROVAL status', async () => {
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVAL') return { id: 21, code: 'PENDING_APPROVAL' };
        return { id: 20, code: 'BORROWED' };
      });
      prisma.availabilityStatus.findUnique.mockResolvedValue({ id: 11, code: 'BORROWED' });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrow_status_id: 21,
      });
      prisma.borrowTransaction.update.mockResolvedValue({ id: 'tx-1', borrow_status_id: 20 });
      prisma.asset.update.mockResolvedValue({});

      const result = await service.approveBorrow('tx-1', acStaffUser);
      expect(result.borrow_status_id).toBe(20);
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: { availability_status_id: 11 },
        }),
      );
    });

    it('should throw BadRequestException if transaction is not PENDING_APPROVAL', async () => {
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVAL') return { id: 21, code: 'PENDING_APPROVAL' };
        return { id: 20, code: 'BORROWED' };
      });
      prisma.availabilityStatus.findUnique.mockResolvedValue({ id: 11, code: 'BORROWED' });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrow_status_id: 20, // already BORROWED
      });

      await expect(service.approveBorrow('tx-1', acStaffUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectBorrow', () => {
    const acStaffUser = { id: 'user-id-2', role: UserRole.ASSET_CENTER_STAFF };

    it('should reject transaction and revert asset to AVAILABLE', async () => {
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVAL') return { id: 21, code: 'PENDING_APPROVAL' };
        return { id: 22, code: 'REJECTED' };
      });
      prisma.availabilityStatus.findUnique.mockResolvedValue({ id: 10, code: 'AVAILABLE' });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrow_status_id: 21,
      });
      prisma.borrowTransaction.update.mockResolvedValue({ id: 'tx-1', borrow_status_id: 22 });
      prisma.asset.update.mockResolvedValue({});

      const result = await service.rejectBorrow('tx-1', 'Not available for external loan', acStaffUser);
      expect(result.borrow_status_id).toBe(22);
      expect(prisma.borrowTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tx-1' },
          data: expect.objectContaining({
            borrow_status_id: 22,
            reject_reason: 'Not available for external loan',
          }),
        }),
      );
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: { availability_status_id: 10 },
        }),
      );
    });
  });
});
