import { Test, TestingModule } from '@nestjs/testing';
import { RepairsService } from './repairs.service';
import { PrismaService } from '../prisma.service';
import { ActionType, ReportType, StepActionType, UrgencyStatus, UserRole } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('RepairsService', () => {
  let service: RepairsService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-uuid-1',
    role: UserRole.MAINTENANCE_STAFF,
    section_id: 'section-uuid-1',
  };

  const mockPrisma = {
    asset: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    repairJob: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    jobStatus: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    jobType: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    cause: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    techCategory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    stepMaster: {
      findMany: jest.fn(),
    },
    repairJobStep: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    mechanicRepair: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    sparepart: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    sparepartTxn: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    assetStatus: {
      findUnique: jest.fn(),
    },
    availabilityStatus: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepairsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RepairsService>(RepairsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('should create repair request and set asset to UNDER_REPAIR and UNAVAILABLE', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-uuid-1',
        section_id: 'section-uuid-1',
        status: { code: 'NORMAL' },
      });
      mockPrisma.jobType.findFirst.mockResolvedValue({ id: 1, name: 'ตรวจเช็คและซ่อมทั่วไป' });
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 1, code: 'PENDING' });
      mockPrisma.assetStatus.findUnique.mockResolvedValue({ id: 3, code: 'UNDER_REPAIR' });
      mockPrisma.availabilityStatus.findUnique.mockResolvedValue({ id: 4, code: 'UNAVAILABLE' });
      mockPrisma.repairJob.findFirst.mockResolvedValue(null); // for jobNo generator
      mockPrisma.repairJob.create.mockResolvedValue({
        id: 'job-uuid-1',
        jobNo: 'REP-202609-0001',
        assetId: 'asset-uuid-1',
        jobStatusId: 1,
      });

      const dto = {
        assetId: 'asset-uuid-1',
        symptom: 'จอแสดงผลดับ ไม่ติด',
        urgencyStatus: UrgencyStatus.NORMAL,
        reportType: ReportType.Repair,
      };

      const result = await service.createRequest(dto, mockUser);

      expect(mockPrisma.asset.findUnique).toHaveBeenCalledWith({
        where: { id: 'asset-uuid-1' },
        include: { status: true },
      });
      expect(mockPrisma.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-uuid-1' },
        data: {
          asset_status_id: 3,
          availability_status_id: 4,
          updatedBy: mockUser.id,
        },
      });
      expect(result).toHaveProperty('jobNo', 'REP-202609-0001');
    });

    it('should throw NotFoundException if asset does not exist', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(
        service.createRequest(
          {
            assetId: 'non-existent',
            symptom: 'test',
            urgencyStatus: UrgencyStatus.NORMAL,
            reportType: ReportType.Repair,
          },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('diagnoseAndPlan', () => {
    it('should validate stock and block INTERNAL_STOCK if spare parts quantity is deficient', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PENDING' },
      });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.sparepart.findUnique.mockResolvedValue({
        id: 10,
        code: 'SP-001',
        name: 'Battery',
        qtyInStock: 2, // only 2 in stock
      });

      const dto = {
        diagnosis: 'แบตเตอรี่เสื่อมสภาพ',
        solution: 'เปลี่ยนแบตเตอรี่ใหม่',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.INTERNAL_STOCK,
        spareParts: [{ sparepartId: 10, qty: 5 }], // requested 5 > 2
      };

      await expect(service.diagnoseAndPlan('job-uuid-1', dto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should clone 12 steps from stepMaster on valid diagnosis', async () => {
      mockPrisma.repairJob.findUnique
        .mockResolvedValueOnce({
          id: 'job-uuid-1',
          jobStatus: { code: 'PENDING' },
        })
        .mockResolvedValueOnce({
          id: 'job-uuid-1',
          jobStatus: { code: 'IN_PROGRESS' },
          repairJobSteps: [],
          sparepartTxns: [],
        });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 2, code: 'IN_PROGRESS' });
      mockPrisma.stepMaster.findMany.mockResolvedValue([
        { id: 1, stepNumber: 1, actionType: StepActionType.SELF_REPAIR, label: 'วันแจ้งซ่อม' },
        { id: 2, stepNumber: 2, actionType: StepActionType.SELF_REPAIR, label: 'ธุรการรับ Job / จ่ายงาน' },
        { id: 3, stepNumber: 3, actionType: StepActionType.SELF_REPAIR, label: 'ช่างรับ Job / วินิจฉัย' },
        { id: 4, stepNumber: 4, actionType: StepActionType.SELF_REPAIR, label: 'ดำเนินการซ่อมและทดสอบการใช้งาน' },
        { id: 5, stepNumber: 5, actionType: StepActionType.SELF_REPAIR, label: 'แล้วเสร็จ / รอตรวจรับงาน' },
        { id: 6, stepNumber: 6, actionType: StepActionType.SELF_REPAIR, label: 'ตรวจรับงานและสรุป Job' },
      ]);
      mockPrisma.repairJob.update.mockResolvedValue({
        id: 'job-uuid-1',
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.SELF_REPAIR,
      });

      const dto = {
        diagnosis: 'น็อตยึดหลวม',
        solution: 'ขันน็อตให้แน่น',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.SELF_REPAIR,
      };

      await service.diagnoseAndPlan('job-uuid-1', dto, mockUser);

      expect(mockPrisma.repairJobStep.deleteMany).toHaveBeenCalledWith({ where: { jobId: 'job-uuid-1' } });
      expect(mockPrisma.repairJobStep.create).toHaveBeenCalledTimes(6);
    });
  });

  describe('spare parts transactions (withdraw & return)', () => {
    it('should deduct stock on spare part withdraw', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        actionType: ActionType.REPAIR,
        repairJobSteps: [
          { stepMaster: { actionType: StepActionType.INTERNAL_STOCK } },
        ],
      });
      mockPrisma.sparepart.findUnique.mockResolvedValue({
        id: 1,
        name: 'Fuse 10A',
        price: '150.00',
        qtyInStock: 10,
      });
      mockPrisma.sparepartTxn.create.mockResolvedValue({
        id: 1,
        sparepartId: 1,
        txnType: 'WITHDRAW',
        qty: 2,
      });

      const result = await service.withdrawSparePart('job-uuid-1', 1, 2, mockUser);

      expect(mockPrisma.sparepart.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { qtyInStock: { decrement: 2 } },
      });
      expect(mockPrisma.sparepartTxn.create).toHaveBeenCalledWith({
        data: {
          sparepartId: 1,
          jobId: 'job-uuid-1',
          txnType: 'WITHDRAW',
          qty: 2,
          unitPrice: '150.00',
          txnBy: mockUser.id,
        },
        include: { sparepart: true, user: true },
      });
    });

    it('should return unused spare parts and increment stock', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'IN_PROGRESS' },
      });
      mockPrisma.sparepart.findUnique.mockResolvedValue({
        id: 1,
        price: '150.00',
      });
      mockPrisma.sparepartTxn.findMany
        .mockResolvedValueOnce([{ qty: 3 }]) // withdrawn: 3
        .mockResolvedValueOnce([]); // returned: 0

      mockPrisma.sparepartTxn.create.mockResolvedValue({
        id: 2,
        txnType: 'RETURN',
        qty: 1,
      });

      await service.returnSparePart('job-uuid-1', { sparepartId: 1, qty: 1 }, mockUser);

      expect(mockPrisma.sparepart.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { qtyInStock: { increment: 1 } },
      });
    });

    it('should reject returning more parts than withdrawn', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'IN_PROGRESS' },
      });
      mockPrisma.sparepart.findUnique.mockResolvedValue({ id: 1, price: '150' });
      mockPrisma.sparepartTxn.findMany
        .mockResolvedValueOnce([{ qty: 2 }]) // withdrawn: 2
        .mockResolvedValueOnce([]);

      await expect(
        service.returnSparePart('job-uuid-1', { sparepartId: 1, qty: 5 }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeAndCloseJob', () => {
    it('should complete job and restore asset status to NORMAL and AVAILABLE', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        assetId: 'asset-uuid-1',
        actionType: ActionType.REPAIR,
        jobStatus: { code: 'IN_PROGRESS' },
        repairJobSteps: [
          { stepMaster: { actionType: StepActionType.SELF_REPAIR, stepNumber: 1 } },
        ],
      });
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 5, code: 'COMPLETED' });
      mockPrisma.assetStatus.findUnique.mockResolvedValue({ id: 1, code: 'NORMAL' });
      mockPrisma.availabilityStatus.findUnique.mockResolvedValue({ id: 1, code: 'AVAILABLE' });
      mockPrisma.repairJob.update.mockResolvedValue({ id: 'job-uuid-1' });

      // Mock findOne for final return
      mockPrisma.repairJob.findUnique.mockResolvedValueOnce({
        id: 'job-uuid-1',
        assetId: 'asset-uuid-1',
        actionType: ActionType.REPAIR,
        jobStatus: { code: 'IN_PROGRESS' },
        repairJobSteps: [
          { stepMaster: { actionType: StepActionType.SELF_REPAIR, stepNumber: 1 } },
        ],
      }).mockResolvedValueOnce({
        id: 'job-uuid-1',
        repairJobSteps: [],
        sparepartTxns: [],
      });

      const dto = {
        warrantyDate: '2028-12-31',
        receiverId: 'receiver-uuid-1',
      };

      await service.completeAndCloseJob('job-uuid-1', dto, mockUser);

      expect(mockPrisma.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-uuid-1' },
        data: {
          asset_status_id: 1,
          availability_status_id: 1,
          updatedBy: mockUser.id,
        },
      });
    });
  });
});
