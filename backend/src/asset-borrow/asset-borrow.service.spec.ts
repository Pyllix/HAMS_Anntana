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
    updateMany: jest.fn(),
  },
  borrowTransaction: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
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

    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });
    prisma.asset.findUnique.mockResolvedValue({
      id: 'asset-1',
      asset_status_id: 1,
      availability_status_id: 10,
      status: { name: 'NORMAL' },
      availabilityStatus: { name: 'AVAILABLE' },
    });
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

    it('should ignore dto.borrowerId, use user.id, set PENDING_APPROVE and RESERVED when user is PARCEL_STAFF (Self Service)', async () => {
      prisma.availabilityStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'AVAILABLE') return { id: 10, code: 'AVAILABLE' };
        if (where.code === 'RESERVED') return { id: 12, code: 'RESERVED' };
        return { id: 11, code: 'BORROWED' };
      });
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVE') return { id: 21, code: 'PENDING_APPROVE' };
        return { id: 20, code: 'BORROWED' };
      });
      prisma.assetStatus.findUnique.mockResolvedValue({ id: 1, code: 'NORMAL' });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', asset_status_id: 1, availability_status_id: 10 });
      prisma.asset.update.mockResolvedValue({});
      prisma.borrowTransaction.create.mockResolvedValue({ id: 'tx-1', request_source: RequestSource.SELF_SERVICE });

      const dtoOther = { ...dto, borrowerId: 'user-id-99' }; // Client passes another ID
      await service.createBorrow(dtoOther, parcelUser);

      // Verify it ignored user-id-99 and used parcelUser's own ID with RESERVED / PENDING_APPROVE
      expect(prisma.asset.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'asset-1' }),
          data: { availability_status_id: 12 },
        }),
      );
      expect(prisma.borrowTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            borrower_id: 'user-id-1',
            created_by_user_id: 'user-id-1',
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
        if (where.code === 'PENDING_APPROVE') return { id: 21, code: 'PENDING_APPROVE' };
        return { id: 20, code: 'BORROWED' };
      });
      prisma.assetStatus.findUnique.mockResolvedValue({ id: 1, code: 'NORMAL' });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.user.findFirst.mockResolvedValue({ id: 'user-id-99' });
      prisma.asset.updateMany.mockResolvedValue({ count: 1 });
      prisma.borrowTransaction.create.mockResolvedValue({ id: 'tx-2', request_source: RequestSource.CENTER_SERVICE });

      const dtoForOther = { ...dto, borrowerId: 'user-id-99' };
      await service.createBorrow(dtoForOther, acStaffUser);

      expect(prisma.asset.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'asset-1' }),
          data: { availability_status_id: 11 },
        }),
      );
      expect(prisma.borrowTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            borrower_id: 'user-id-99',
            created_by_user_id: 'user-id-2',
            approved_by_user_id: 'user-id-2',
            handover_by_user_id: 'user-id-2',
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
        if (where.code === 'PENDING_APPROVE') return { id: 21, code: 'PENDING_APPROVE' };
        return { id: 20, code: 'BORROWED' };
      });
      prisma.assetStatus.findUnique.mockResolvedValue({ id: 1, code: 'NORMAL' });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.asset.updateMany.mockResolvedValue({ count: 0 }); // simulate asset not available

      await expect(service.createBorrow(dto, parcelUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('approveBorrow', () => {
    const acStaffUser = { id: 'user-id-2', role: UserRole.ASSET_CENTER_STAFF };

    it('should approve transaction in PENDING_APPROVE status (sets APPROVED, approved_at, and approved_by_user_id)', async () => {
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVE') return { id: 21, code: 'PENDING_APPROVE' };
        if (where.code === 'APPROVED') return { id: 25, code: 'APPROVED' };
        return { id: 20, code: 'BORROWED' };
      });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.borrowTransaction.findUnique
        .mockResolvedValueOnce({
          id: 'tx-1',
          asset_id: 'asset-1',
          borrow_status_id: 21,
        })
        .mockResolvedValueOnce({ id: 'tx-1', borrow_status_id: 25 });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.approveBorrow('tx-1', acStaffUser);
      expect(result?.borrow_status_id).toBe(25);
      expect(prisma.borrowTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tx-1', borrow_status_id: 21 },
          data: expect.objectContaining({
            borrow_status_id: 25,
            approved_at: expect.any(Date),
            approved_by_user_id: 'user-id-2',
          }),
        }),
      );
    });

    it('should throw BadRequestException if transaction is not PENDING_APPROVE', async () => {
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVE') return { id: 21, code: 'PENDING_APPROVE' };
        return { id: 20, code: 'BORROWED' };
      });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrow_status_id: 20, // already BORROWED
      });

      await expect(service.approveBorrow('tx-1', acStaffUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('handoverAsset', () => {
    const acStaffUser = { id: 'user-id-2', role: UserRole.ASSET_CENTER_STAFF };

    it('should handover transaction in APPROVED status (sets BORROWED, handover_date, handover_by_user_id, and asset to BORROWED)', async () => {
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'APPROVED') return { id: 25, code: 'APPROVED' };
        if (where.code === 'BORROWED') return { id: 20, code: 'BORROWED' };
      });
      prisma.availabilityStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'RESERVED') return { id: 12, code: 'RESERVED' };
        if (where.code === 'BORROWED') return { id: 11, code: 'BORROWED' };
      });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.borrowTransaction.findUnique
        .mockResolvedValueOnce({
          id: 'tx-1',
          asset_id: 'asset-1',
          borrow_status_id: 25, // APPROVED
        })
        .mockResolvedValueOnce({ id: 'tx-1', borrow_status_id: 20 });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });
      prisma.asset.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.handoverAsset('tx-1', acStaffUser);
      expect(result?.borrow_status_id).toBe(20);
      expect(prisma.borrowTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tx-1', borrow_status_id: 25 },
          data: expect.objectContaining({
            borrow_status_id: 20,
            handover_date: expect.any(Date),
            handover_by_user_id: 'user-id-2',
          }),
        }),
      );
      expect(prisma.asset.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'asset-1', availability_status_id: 12 }),
          data: { availability_status_id: 11 },
        }),
      );
    });

    it('should throw BadRequestException if transaction is not in APPROVED status', async () => {
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'APPROVED') return { id: 25, code: 'APPROVED' };
        return { id: 21, code: 'PENDING_APPROVE' };
      });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrow_status_id: 21, // PENDING_APPROVE
      });

      await expect(service.handoverAsset('tx-1', acStaffUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectBorrow', () => {
    const acStaffUser = { id: 'user-id-2', role: UserRole.ASSET_CENTER_STAFF };

    it('should reject transaction and revert asset to AVAILABLE', async () => {
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVE') return { id: 21, code: 'PENDING_APPROVE' };
        return { id: 22, code: 'REJECTED' };
      });
      prisma.availabilityStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'RESERVED') return { id: 12, code: 'RESERVED' };
        return { id: 10, code: 'AVAILABLE' };
      });

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.borrowTransaction.findUnique
        .mockResolvedValueOnce({
          id: 'tx-1',
          asset_id: 'asset-1',
          borrow_status_id: 21,
        })
        .mockResolvedValueOnce({ id: 'tx-1', borrow_status_id: 22 });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });
      prisma.asset.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.rejectBorrow('tx-1', 'Not available for external loan', acStaffUser);
      expect(result?.borrow_status_id).toBe(22);
      expect(prisma.borrowTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'tx-1' }),
          data: expect.objectContaining({
            borrow_status_id: 22,
            reject_remark: 'Not available for external loan',
            rejected_by_user_id: 'user-id-2',
          }),
        }),
      );
      expect(prisma.asset.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'asset-1' }),
          data: { availability_status_id: 10 },
        }),
      );
    });

    it('should throw ConflictException if asset update fails in rejectBorrow', async () => {
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVE') return { id: 21, code: 'PENDING_APPROVE' };
        return { id: 22, code: 'REJECTED' };
      });
      prisma.availabilityStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'RESERVED') return { id: 12, code: 'RESERVED' };
        return { id: 10, code: 'AVAILABLE' };
      });
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrow_status_id: 21,
      });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });
      prisma.asset.updateMany.mockResolvedValue({ count: 0 }); // failed

      await expect(service.rejectBorrow('tx-1', 'Reason', acStaffUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('createBorrow - Asset validation & Concurrency', () => {
    const parcelUser = { id: 'user-id-1', role: UserRole.PARCEL_STAFF };
    const dto = { assetId: 'asset-1', deliveryMethod: DeliveryMethod.PICKUP };

    beforeEach(() => {
      prisma.availabilityStatus.findUnique.mockResolvedValue({ id: 10, code: 'AVAILABLE' });
      prisma.borrowStatus.findUnique.mockResolvedValue({ id: 21, code: 'PENDING_APPROVE' });
      prisma.assetStatus.findUnique.mockResolvedValue({ id: 1, code: 'NORMAL' });
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    });

    it('should throw NotFoundException if asset does not exist', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.createBorrow(dto, parcelUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if asset is DAMAGED', async () => {
      prisma.asset.findUnique.mockResolvedValue({
        id: 'asset-1',
        asset_status_id: 2, // DAMAGED
        availability_status_id: 10,
        status: { name: 'DAMAGED' },
        availabilityStatus: { name: 'AVAILABLE' },
      });
      await expect(service.createBorrow(dto, parcelUser)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if atomic asset update fails (concurrency)', async () => {
      prisma.asset.findUnique.mockResolvedValue({
        id: 'asset-1',
        asset_status_id: 1,
        availability_status_id: 10,
        status: { name: 'NORMAL' },
        availabilityStatus: { name: 'AVAILABLE' },
      });
      prisma.asset.updateMany.mockResolvedValue({ count: 0 }); // another transaction grabbed it
      await expect(service.createBorrow(dto, parcelUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('returnAsset - Permissions & Spoofing Prevention', () => {
    const borrowerUser = { id: 'user-id-1', role: UserRole.DEPARTMENT_STAFF, section_id: 'sec-opd' };
    const sameDeptUser = { id: 'user-id-2', role: UserRole.DEPARTMENT_STAFF, section_id: 'sec-opd' };
    const diffDeptUser = { id: 'user-id-3', role: UserRole.DEPARTMENT_STAFF, section_id: 'sec-icu' };
    const acStaffUser = { id: 'user-id-4', role: UserRole.ASSET_CENTER_STAFF, section_id: 'sec-it' };
    const returnDto = {
      returnCondition: ReturnCondition.Normal,
      returnMethod: ReturnMethod.self_return,
    };

    beforeEach(() => {
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'BORROWED') return { id: 20, code: 'BORROWED' };
        if (where.code === 'RETURNED') return { id: 23, code: 'RETURNED' };
        if (where.code === 'PENDING_VERIFICATION') return { id: 26, code: 'PENDING_VERIFICATION' };
      });
      prisma.availabilityStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'BORROWED') return { id: 11, code: 'BORROWED' };
        if (where.code === 'UNAVAILABLE') return { id: 13, code: 'UNAVAILABLE' };
        return { id: 10, code: 'AVAILABLE' };
      });
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    });

    it('should allow original borrower to return their asset', async () => {
      prisma.borrowTransaction.findUnique
        .mockResolvedValueOnce({
          id: 'tx-1',
          asset_id: 'asset-1',
          borrower_id: 'user-id-1',
          borrow_status_id: 20,
          borrower: { section_id: 'sec-opd' },
        })
        .mockResolvedValueOnce({ id: 'tx-1', borrow_status_id: 23 });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });

      await service.returnAsset('tx-1', returnDto, borrowerUser);
      expect(prisma.borrowTransaction.updateMany).toHaveBeenCalled();
    });

    it('should allow another staff in the same department to return the asset', async () => {
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrower_id: 'user-id-1',
        borrow_status_id: 20,
        borrower: { section_id: 'sec-opd' },
      });
      prisma.borrowTransaction.update.mockResolvedValue({ id: 'tx-1' });

      await service.returnAsset('tx-1', returnDto, sameDeptUser);
      expect(prisma.borrowTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            returned_by_user_id: 'user-id-2',
          }),
        }),
      );
    });

    it('should throw BadRequestException if staff from a different department attempts to return', async () => {
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrower_id: 'user-id-1', // owned by user-id-1 in sec-opd
        borrow_status_id: 20,
        borrower: { section_id: 'sec-opd' },
      });

      await expect(service.returnAsset('tx-1', returnDto, diffDeptUser)).rejects.toThrow(BadRequestException);
    });

    it('should ignore returnedByUserId when caller is DEPARTMENT_STAFF', async () => {
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrower_id: 'user-id-1',
        borrow_status_id: 20,
        borrower: { section_id: 'sec-opd' },
      });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });
      prisma.asset.updateMany.mockResolvedValue({ count: 1 });
      prisma.borrowTransaction.findUnique
        .mockResolvedValueOnce({
          id: 'tx-1',
          asset_id: 'asset-1',
          borrower_id: 'user-id-1',
          borrow_status_id: 20,
          borrower: { section_id: 'sec-opd' },
        })
        .mockResolvedValueOnce({ id: 'tx-1', returned_by_user_id: 'user-id-1' });

      const maliciousDto = { ...returnDto, returnedByUserId: 'victim-id-99' };
      await service.returnAsset('tx-1', maliciousDto, borrowerUser);

      // Must be borrowerUser's own ID, ignoring victim-id-99
      expect(prisma.borrowTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            returned_by_user_id: 'user-id-1',
          }),
        }),
      );
    });

    it('should allow ASSET_CENTER_STAFF to return for any borrower and specify returnedByUserId', async () => {
      prisma.borrowTransaction.findUnique
        .mockResolvedValueOnce({
          id: 'tx-1',
          asset_id: 'asset-1',
          borrower_id: 'user-id-1',
          borrow_status_id: 20,
          borrower: { section_id: 'sec-opd' },
        })
        .mockResolvedValueOnce({ id: 'tx-1' });
      prisma.user.findFirst.mockResolvedValue({ id: 'user-id-99' });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });
      prisma.asset.updateMany.mockResolvedValue({ count: 1 });

      const staffDto = { ...returnDto, returnedByUserId: 'user-id-99' };
      await service.returnAsset('tx-1', staffDto, acStaffUser);

      expect(prisma.borrowTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            borrow_status_id: 23,
            returned_by_user_id: 'user-id-99',
            received_by_user_id: 'user-id-4',
          }),
        }),
      );
    });
    it('should throw BadRequestException if transaction is not BORROWED and include current status code in error message', async () => {
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrower_id: 'user-id-1',
        borrow_status_id: 21,
        borrowStatus: { code: 'PENDING_APPROVE', name: 'Pending Approval' },
        borrower: { section_id: 'sec-opd' },
      });

      await expect(service.returnAsset('tx-1', returnDto, borrowerUser)).rejects.toThrow(
        /Cannot return asset: transaction is currently in 'PENDING_APPROVE' status \(expected BORROWED\)/,
      );
    });

    it('should fallback to DB lookup when user.section_id is missing from session', async () => {
      const userWithoutSectionInSession = { id: 'user-id-1', role: UserRole.DEPARTMENT_STAFF }; // no section_id in session
      prisma.borrowTransaction.findUnique
        .mockResolvedValueOnce({
          id: 'tx-1',
          asset_id: 'asset-1',
          borrower_id: 'user-id-2',
          borrow_status_id: 20,
          borrower: { section_id: 'sec-opd' },
        })
        .mockResolvedValueOnce({ id: 'tx-1' });
      // DB lookup returns sec-opd
      prisma.user.findUnique.mockResolvedValue({ id: 'user-id-1', section_id: 'sec-opd' });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });
      prisma.asset.updateMany.mockResolvedValue({ count: 1 });

      await service.returnAsset('tx-1', returnDto, userWithoutSectionInSession);
      expect(prisma.borrowTransaction.updateMany).toHaveBeenCalled();
    });

    it('should throw ConflictException if asset update fails in returnAsset', async () => {
      prisma.borrowTransaction.findUnique
        .mockResolvedValueOnce({
          id: 'tx-1',
          asset_id: 'asset-1',
          borrower_id: 'user-id-1',
          borrow_status_id: 20,
          borrower: { section_id: 'sec-opd' },
        });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });
      prisma.asset.updateMany.mockResolvedValue({ count: 0 }); // asset not in BORROWED

      await expect(service.returnAsset('tx-1', returnDto, borrowerUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('cancelBorrow - Permissions & Department Scoping', () => {
    const borrowerUser = { id: 'user-id-1', role: UserRole.DEPARTMENT_STAFF, section_id: 'sec-opd' };
    const sameDeptUser = { id: 'user-id-2', role: UserRole.DEPARTMENT_STAFF, section_id: 'sec-opd' };
    const diffDeptUser = { id: 'user-id-3', role: UserRole.DEPARTMENT_STAFF, section_id: 'sec-icu' };
    const acStaffUser = { id: 'user-id-4', role: UserRole.ASSET_CENTER_STAFF, section_id: 'sec-it' };

    beforeEach(() => {
      prisma.borrowStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'PENDING_APPROVE') return { id: 21, code: 'PENDING_APPROVE' };
        if (where.code === 'APPROVED') return { id: 25, code: 'APPROVED' };
        if (where.code === 'BORROWED') return { id: 20, code: 'BORROWED' };
        if (where.code === 'CANCELLED') return { id: 24, code: 'CANCELLED' };
      });
      prisma.availabilityStatus.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.code === 'AVAILABLE') return { id: 10, code: 'AVAILABLE' };
        if (where.code === 'RESERVED') return { id: 12, code: 'RESERVED' };
        if (where.code === 'BORROWED') return { id: 11, code: 'BORROWED' };
      });
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    });

    it('should allow borrower to cancel their pending transaction', async () => {
      prisma.borrowTransaction.findUnique
        .mockResolvedValueOnce({
          id: 'tx-1',
          asset_id: 'asset-1',
          borrower_id: 'user-id-1',
          borrow_status_id: 21,
          borrower: { section_id: 'sec-opd' },
        })
        .mockResolvedValueOnce({ id: 'tx-1', borrow_status_id: 24 });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cancelBorrow('tx-1', { cancelReason: 'No longer needed' }, borrowerUser);
      expect(result?.borrow_status_id).toBe(24);
      expect(prisma.borrowTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            borrow_status_id: 24,
            cancelled_by_user_id: 'user-id-1',
            cancel_reason: 'No longer needed',
          }),
        }),
      );
      expect(prisma.asset.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'asset-1', availability_status_id: 12 }),
          data: { availability_status_id: 10 },
        }),
      );
    });

    it('should allow another staff in the same department to cancel the pending transaction', async () => {
      prisma.borrowTransaction.findUnique
        .mockResolvedValueOnce({
          id: 'tx-1',
          asset_id: 'asset-1',
          borrower_id: 'user-id-1',
          borrow_status_id: 21,
          borrower: { section_id: 'sec-opd' },
        })
        .mockResolvedValueOnce({ id: 'tx-1', borrow_status_id: 24 });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cancelBorrow('tx-1', {}, sameDeptUser);
      expect(result?.borrow_status_id).toBe(24);
    });

    it('should throw BadRequestException if DEPARTMENT_STAFF tries to cancel an APPROVED transaction', async () => {
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrower_id: 'user-id-1',
        borrow_status_id: 25, // APPROVED
        borrower: { section_id: 'sec-opd' },
      });

      await expect(service.cancelBorrow('tx-1', {}, borrowerUser)).rejects.toThrow(
        /Department staff can only cancel transactions that are pending approval/,
      );
    });

    it('should allow ASSET_CENTER_STAFF to cancel an APPROVED transaction (e.g. approved by mistake)', async () => {
      prisma.borrowTransaction.findUnique
        .mockResolvedValueOnce({
          id: 'tx-1',
          asset_id: 'asset-1',
          borrower_id: 'user-id-1',
          borrow_status_id: 25, // APPROVED
          borrower: { section_id: 'sec-opd' },
        })
        .mockResolvedValueOnce({ id: 'tx-1', borrow_status_id: 24 });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cancelBorrow('tx-1', { cancelReason: 'Wrong approval' }, acStaffUser);
      expect(result?.borrow_status_id).toBe(24);
    });

    it('should throw BadRequestException if anyone (including staff) attempts to cancel a BORROWED transaction', async () => {
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrower_id: 'user-id-1',
        borrow_status_id: 20, // BORROWED
        borrower: { section_id: 'sec-opd' },
      });

      await expect(service.cancelBorrow('tx-1', {}, acStaffUser)).rejects.toThrow(
        /Cannot cancel a transaction that has already been dispatched \(BORROWED\)/,
      );
    });

    it('should throw BadRequestException if staff from a different department attempts to cancel', async () => {
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrower_id: 'user-id-1',
        borrow_status_id: 21,
        borrower: { section_id: 'sec-opd' },
      });

      await expect(service.cancelBorrow('tx-1', {}, diffDeptUser)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if optimistic lock fails during cancelBorrow', async () => {
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrower_id: 'user-id-1',
        borrow_status_id: 21,
        borrower: { section_id: 'sec-opd' },
      });
      // Simulate concurrent update: updateMany count is 0
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.cancelBorrow('tx-1', {}, borrowerUser)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if transaction is already RETURNED or CANCELLED', async () => {
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrower_id: 'user-id-1',
        borrow_status_id: 23, // RETURNED
        borrowStatus: { code: 'RETURNED' },
        borrower: { section_id: 'sec-opd' },
      });

      await expect(service.cancelBorrow('tx-1', {}, borrowerUser)).rejects.toThrow(
        /Only pending \(PENDING_APPROVE\) or approved \(APPROVED\) transactions can be cancelled/,
      );
    });

    it('should throw ConflictException if asset availability update fails in cancelBorrow', async () => {
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asset_id: 'asset-1',
        borrower_id: 'user-id-1',
        borrow_status_id: 21,
        borrower: { section_id: 'sec-opd' },
      });
      prisma.borrowTransaction.updateMany.mockResolvedValue({ count: 1 });
      prisma.asset.updateMany.mockResolvedValue({ count: 0 }); // asset not in RESERVED

      await expect(service.cancelBorrow('tx-1', {}, borrowerUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll & findOne - Data Scoping', () => {
    const deptUser = { id: 'user-id-1', role: UserRole.DEPARTMENT_STAFF, section_id: 'sec-opd' };
    const adminUser = { id: 'admin-id', role: UserRole.ADMIN };

    it('should enforce where.borrower.section_id = user.section_id for DEPARTMENT_STAFF in findAll', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      await service.findAll({}, deptUser);

      expect(prisma.borrowTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            borrower: { section_id: 'sec-opd' },
          }),
        }),
      );
    });

    it('should allow DEPARTMENT_STAFF to view a transaction in the same department in findOne', async () => {
      const mockTx = {
        id: 'tx-1',
        borrower_id: 'user-id-2',
        borrower: { section_id: 'sec-opd' },
      };
      prisma.borrowTransaction.findUnique.mockResolvedValue(mockTx);

      const result = await service.findOne('tx-1', deptUser);
      expect(result).toEqual(mockTx);
    });

    it('should throw NotFoundException if DEPARTMENT_STAFF views a transaction from another department in findOne', async () => {
      prisma.borrowTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        borrower_id: 'user-id-99',
        borrower: { section_id: 'sec-icu' }, // different section
      });

      await expect(service.findOne('tx-1', deptUser)).rejects.toThrow(NotFoundException);
    });

    it('should allow ADMIN to view any transaction in findOne', async () => {
      const mockTx = { id: 'tx-1', borrower_id: 'user-id-99' };
      prisma.borrowTransaction.findUnique.mockResolvedValue(mockTx);

      const result = await service.findOne('tx-1', adminUser);
      expect(result).toEqual(mockTx);
    });
  });
});
