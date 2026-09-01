import { Test, TestingModule } from '@nestjs/testing';
import { RepairsService } from './repairs.service';
import { PrismaService } from '../prisma.service';
import { ActionType, ReportType, StepActionType, UrgencyStatus, UserRole } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

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
    company: {
      findUnique: jest.fn(),
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
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    assetStatus: {
      findUnique: jest.fn(),
    },
    availabilityStatus: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 1, code: 'PENDING_ASSIGN' });
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

    it('should reject createRequest if asset already has an active repair job', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-uuid-1',
        name: 'เครื่องวัดความดัน',
        noid: 'MED-001',
        section_id: 'section-uuid-1',
        status: { code: 'UNDER_REPAIR' },
      });
      mockPrisma.repairJob.findFirst.mockResolvedValue({
        id: 'existing-job',
        jobNo: 'REP-202609-0001',
        jobStatus: { code: 'IN_PROGRESS', name: 'กำลังดำเนินการ' },
      });

      await expect(
        service.createRequest(
          {
            assetId: 'asset-uuid-1',
            symptom: 'เปิดไม่ติดอีกรอบ',
            urgencyStatus: UrgencyStatus.NORMAL,
            reportType: ReportType.Repair,
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject createRequest if asset is DISPOSAL or LOST', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-uuid-1',
        name: 'เตียงคนไข้',
        noid: 'MED-999',
        status: { code: 'DISPOSAL' },
      });

      await expect(
        service.createRequest(
          {
            assetId: 'asset-uuid-1',
            symptom: 'พัง',
            urgencyStatus: UrgencyStatus.NORMAL,
            reportType: ReportType.Repair,
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
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
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        role: UserRole.MAINTENANCE_STAFF,
        firstname: 'Somchai',
        lastname: 'Tech',
      });
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

      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        role: UserRole.MAINTENANCE_STAFF,
        firstname: 'Somchai',
        lastname: 'Tech',
      });

      await service.diagnoseAndPlan('job-uuid-1', dto, mockUser);

      expect(mockPrisma.repairJobStep.deleteMany).toHaveBeenCalledWith({ where: { jobId: 'job-uuid-1' } });
      expect(mockPrisma.repairJobStep.create).toHaveBeenCalledTimes(6);
    });

    it('should record PENDING_WITHDRAW transactions on diagnoseAndPlan without deducting stock yet', async () => {
      mockPrisma.repairJob.findUnique
        .mockResolvedValueOnce({
          id: 'job-uuid-1',
          jobStatus: { code: 'PENDING' },
        })
        .mockResolvedValueOnce({
          id: 'job-uuid-1',
          jobStatus: { code: 'PARCEL_PROCESSING' },
          repairJobSteps: [],
          sparepartTxns: [
            {
              sparepartId: 10,
              txnType: 'PENDING_WITHDRAW',
              qty: 2,
              unitPrice: '500.00',
            },
          ],
        });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 3, code: 'PARCEL_PROCESSING' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        role: UserRole.MAINTENANCE_STAFF,
        firstname: 'Somchai',
        lastname: 'Tech',
      });
      mockPrisma.sparepart.findUnique.mockResolvedValue({
        id: 10,
        name: 'Battery',
        price: '500.00',
        qtyInStock: 5,
      });
      mockPrisma.stepMaster.findMany.mockResolvedValue([
        { id: 1, stepNumber: 1, actionType: StepActionType.INTERNAL_STOCK, label: 'วันแจ้งซ่อม' },
      ]);
      mockPrisma.sparepartTxn.findMany.mockResolvedValue([]);

      const dto = {
        diagnosis: 'แบตเตอรี่เสื่อม',
        solution: 'เปลี่ยนแบตเตอรี่',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.INTERNAL_STOCK,
        spareParts: [{ sparepartId: 10, qty: 2 }],
      };

      const result = await service.diagnoseAndPlan('job-uuid-1', dto, mockUser);

      // Stock is NOT decremented yet in diagnoseAndPlan
      expect(mockPrisma.sparepart.update).not.toHaveBeenCalled();
      expect(mockPrisma.sparepartTxn.create).toHaveBeenCalledWith({
        data: {
          sparepartId: 10,
          jobId: 'job-uuid-1',
          txnType: 'PENDING_WITHDRAW',
          qty: 2,
          unitPrice: '500.00',
          txnBy: mockUser.id,
        },
      });
      // Cost of pending items is 0 until approved
      expect(result.summary.totalSparePartsCost).toBe(0);
    });

    it('should reject assigning users without MAINTENANCE_STAFF role as mechanics', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PENDING' },
      });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-non-mech',
        role: UserRole.DEPARTMENT_STAFF, // Not maintenance staff
        firstname: 'Jane',
        lastname: 'Office',
      });

      const dto = {
        diagnosis: 'ตรวจเช็ค',
        solution: 'แก้ไข',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.SELF_REPAIR,
        mechanicIds: ['user-non-mech'],
      };

      await expect(service.diagnoseAndPlan('job-uuid-1', dto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject OUTSOURCE if companyId is missing or if spareParts are provided', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PENDING' },
      });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });

      // 1. Missing companyId
      const dtoNoCompany: any = {
        diagnosis: 'ส่งซ่อมนอก',
        solution: 'ส่งศูนย์บริการ',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.OUTSOURCE,
      };
      await expect(service.diagnoseAndPlan('job-uuid-1', dtoNoCompany, mockUser)).rejects.toThrow(
        BadRequestException,
      );

      // 2. OUTSOURCE with spareParts
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      const dtoWithSpareParts: any = {
        ...dtoNoCompany,
        companyId: 'comp-1',
        spareParts: [{ sparepartId: 1, qty: 1 }],
      };
      await expect(service.diagnoseAndPlan('job-uuid-1', dtoWithSpareParts, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject non-OUTSOURCE if companyId or billNo is provided', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PENDING' },
      });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });

      const dto: any = {
        diagnosis: 'ซ่อมเอง',
        solution: 'ตรวจเช็ค',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.SELF_REPAIR,
        companyId: 'comp-1',
      };
      await expect(service.diagnoseAndPlan('job-uuid-1', dto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject INTERNAL_STOCK if spareParts array is empty or missing', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PENDING' },
      });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });

      const dto: any = {
        diagnosis: 'เบิกอะไหล่',
        solution: 'เปลี่ยนของ',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.INTERNAL_STOCK,
        spareParts: [],
      };
      await expect(service.diagnoseAndPlan('job-uuid-1', dto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject SELF_REPAIR if spareParts are provided', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PENDING' },
      });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });

      const dto: any = {
        diagnosis: 'ซ่อมเอง',
        solution: 'ตรวจเช็ค',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.SELF_REPAIR,
        spareParts: [{ sparepartId: 1, qty: 1 }],
      };
      await expect(service.diagnoseAndPlan('job-uuid-1', dto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject duplicate spare parts in the same diagnose request', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PENDING' },
        repairJobSteps: [],
      });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });

      const dto: any = {
        diagnosis: 'เบิกอะไหล่ซ้ำ',
        solution: 'เปลี่ยนของ',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.INTERNAL_STOCK,
        spareParts: [
          { sparepartId: 10, qty: 1 },
          { sparepartId: 10, qty: 2 },
        ],
      };

      await expect(service.diagnoseAndPlan('job-uuid-1', dto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject re-diagnosing a job that has already progressed beyond diagnosis steps', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'IN_PROGRESS' },
        repairJobSteps: [
          {
            completeAt: new Date(),
            stepMaster: { stepNumber: 5, actionType: StepActionType.INTERNAL_STOCK },
          },
        ],
      });

      const dto: any = {
        diagnosis: 'พยายามวินิจฉัยซ้ำตอนซ่อมแล้ว',
        solution: 'แก้ไข',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.INTERNAL_STOCK,
        spareParts: [{ sparepartId: 10, qty: 1 }],
      };

      await expect(service.diagnoseAndPlan('job-uuid-1', dto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMechanics', () => {
    it('should return all active users with MAINTENANCE_STAFF role', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'mech-1',
          employeeId: 'EMP001',
          firstname: 'Somchai',
          lastname: 'Tech',
          role: UserRole.MAINTENANCE_STAFF,
        },
      ]);

      const result = await service.getMechanics();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: UserRole.MAINTENANCE_STAFF,
          deletedAt: null,
        },
        select: expect.any(Object),
        orderBy: { firstname: 'asc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('spare parts transactions (return)', () => {

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

  describe('updateStepProgress & validateStepRole', () => {
    it('should reject ADMIN or MAINTENANCE_STAFF on approval steps (Step 5)', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        repairJobSteps: [
          {
            id: 101,
            stepMaster: { stepNumber: 5, actionType: StepActionType.INTERNAL_STOCK },
          },
        ],
        jobStatus: { code: 'PARCEL_PROCESSING' },
      });

      // Admin user
      const adminUser = { id: 'admin-uuid', role: UserRole.ADMIN };

      await expect(() =>
        service.updateStepProgress('job-uuid-1', 5, {}, adminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject updating a step that has already been completed', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        repairJobSteps: [
          {
            id: 101,
            completeAt: new Date(),
            stepMaster: { stepNumber: 1, actionType: StepActionType.SELF_REPAIR, label: 'วันแจ้งซ่อม' },
          },
        ],
        jobStatus: { code: 'IN_PROGRESS' },
      });

      await expect(
        service.updateStepProgress('job-uuid-1', 1, {}, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject skipping steps when previous step is not completed', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        repairJobSteps: [
          {
            id: 101,
            completeAt: null,
            stepMaster: { stepNumber: 1, actionType: StepActionType.SELF_REPAIR, label: 'วันแจ้งซ่อม' },
          },
          {
            id: 102,
            completeAt: null,
            stepMaster: { stepNumber: 2, actionType: StepActionType.SELF_REPAIR, label: 'ธุรการรับ Job' },
          },
        ],
        jobStatus: { code: 'IN_PROGRESS' },
      });

      await expect(
        service.updateStepProgress('job-uuid-1', 2, {}, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should advance to the first incomplete step automatically with advanceNextStep', async () => {
      mockPrisma.repairJob.findUnique
        .mockResolvedValueOnce({
          id: 'job-uuid-1',
          repairJobSteps: [
            {
              id: 101,
              completeAt: new Date(),
              stepMaster: { stepNumber: 1, actionType: StepActionType.SELF_REPAIR, label: 'วันแจ้งซ่อม' },
            },
            {
              id: 102,
              completeAt: null,
              stepMaster: { stepNumber: 2, actionType: StepActionType.SELF_REPAIR, label: 'ธุรการรับ Job' },
            },
            {
              id: 103,
              completeAt: null,
              stepMaster: { stepNumber: 3, actionType: StepActionType.SELF_REPAIR, label: 'ตรวจรับงานและสรุป Job' },
            },
          ],
        })
        .mockResolvedValueOnce({
          id: 'job-uuid-1',
          repairJobSteps: [
            {
              id: 101,
              completeAt: new Date(),
              stepMaster: { stepNumber: 1, actionType: StepActionType.SELF_REPAIR, label: 'วันแจ้งซ่อม' },
            },
            {
              id: 102,
              completeAt: null,
              stepMaster: { stepNumber: 2, actionType: StepActionType.SELF_REPAIR, label: 'ธุรการรับ Job' },
            },
            {
              id: 103,
              completeAt: null,
              stepMaster: { stepNumber: 3, actionType: StepActionType.SELF_REPAIR, label: 'ตรวจรับงานและสรุป Job' },
            },
          ],
          jobStatus: { code: 'IN_PROGRESS' },
        })
        .mockResolvedValueOnce({
          id: 'job-uuid-1',
          repairJobSteps: [],
          sparepartTxns: [],
        });
      mockPrisma.repairJobStep.update.mockResolvedValue({ id: 102 });

      await service.advanceNextStep('job-uuid-1', { note: 'Done step 2' }, mockUser);

      expect(mockPrisma.repairJobStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 102 },
          data: expect.objectContaining({
            note: 'Done step 2',
            completedBy: mockUser.id,
          }),
        }),
      );
    });

    it('should throw BadRequestException if all steps are already completed in advanceNextStep', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        repairJobSteps: [
          {
            id: 101,
            completeAt: new Date(),
            stepMaster: { stepNumber: 1, actionType: StepActionType.SELF_REPAIR, label: 'วันแจ้งซ่อม' },
          },
        ],
      });

      await expect(
        service.advanceNextStep('job-uuid-1', {}, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require receiverId and warrantyDate on final step', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        repairJobSteps: [
          {
            id: 101,
            completeAt: new Date(),
            stepMaster: { stepNumber: 1, actionType: StepActionType.SELF_REPAIR, label: 'วันแจ้งซ่อม' },
          },
          {
            id: 102,
            completeAt: null,
            stepMaster: { stepNumber: 2, actionType: StepActionType.SELF_REPAIR, label: 'ตรวจรับงานและสรุป Job' },
          },
        ],
        jobStatus: { code: 'IN_PROGRESS' },
      });

      // Missing receiverId
      await expect(
        service.updateStepProgress('job-uuid-1', 2, { warrantyDate: '2028-01-01' }, mockUser),
      ).rejects.toThrow(BadRequestException);

      // Missing warrantyDate
      await expect(
        service.updateStepProgress('job-uuid-1', 2, { receiverId: 'user-2' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject receiverId or warrantyDate on non-final steps', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        repairJobSteps: [
          {
            id: 101,
            completeAt: null,
            stepMaster: { stepNumber: 1, actionType: StepActionType.SELF_REPAIR, label: 'วันแจ้งซ่อม' },
          },
          {
            id: 102,
            completeAt: null,
            stepMaster: { stepNumber: 2, actionType: StepActionType.SELF_REPAIR, label: 'ตรวจรับงานและสรุป Job' },
          },
        ],
        jobStatus: { code: 'IN_PROGRESS' },
      });

      // Providing receiverId on Step 1 (non-final)
      await expect(
        service.updateStepProgress('job-uuid-1', 1, { receiverId: 'user-2' }, mockUser),
      ).rejects.toThrow(BadRequestException);

      // Providing warrantyDate on Step 1 (non-final)
      await expect(
        service.updateStepProgress('job-uuid-1', 1, { warrantyDate: '2028-01-01' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deduct spare parts stock and convert PENDING_WITHDRAW to WITHDRAW when Parcel approves Step 5', async () => {
      const parcelUser = { id: 'parcel-user-1', role: UserRole.PARCEL_STAFF };
      mockPrisma.repairJob.findUnique
        .mockResolvedValueOnce({
          id: 'job-uuid-1',
          repairJobSteps: [
            {
              id: 101,
              completeAt: new Date(),
              stepMaster: { stepNumber: 1, actionType: StepActionType.INTERNAL_STOCK, label: 'วันแจ้งซ่อม' },
            },
            {
              id: 102,
              completeAt: new Date(),
              stepMaster: { stepNumber: 2, actionType: StepActionType.INTERNAL_STOCK, label: 'ธุรการรับ Job' },
            },
            {
              id: 103,
              completeAt: new Date(),
              stepMaster: { stepNumber: 3, actionType: StepActionType.INTERNAL_STOCK, label: 'ช่างรับ Job' },
            },
            {
              id: 104,
              completeAt: new Date(),
              stepMaster: { stepNumber: 4, actionType: StepActionType.INTERNAL_STOCK, label: 'ขอเบิกอะไหล่' },
            },
            {
              id: 105,
              completeAt: null,
              stepMaster: { stepNumber: 5, actionType: StepActionType.INTERNAL_STOCK, label: 'อนุมัติจัดหาอะไหล่ในคลัง' },
            },
            {
              id: 106,
              completeAt: null,
              stepMaster: { stepNumber: 6, actionType: StepActionType.INTERNAL_STOCK, label: 'พัสดุจ่ายอะไหล่ในคลัง' },
            },
          ],
          jobStatus: { code: 'PARCEL_PROCESSING' },
        })
        .mockResolvedValueOnce({
          id: 'job-uuid-1',
          repairJobSteps: [],
          sparepartTxns: [
            {
              id: 1,
              sparepartId: 10,
              txnType: 'WITHDRAW',
              qty: 2,
              unitPrice: '500.00',
            },
          ],
        });

      mockPrisma.sparepartTxn.findMany.mockResolvedValueOnce([
        { id: 1, sparepartId: 10, qty: 2, txnType: 'PENDING_WITHDRAW' },
      ]);
      mockPrisma.sparepart.findUnique.mockResolvedValue({
        id: 10,
        name: 'Battery',
        qtyInStock: 5,
      });

      await service.updateStepProgress('job-uuid-1', 5, {}, parcelUser);

      expect(mockPrisma.sparepart.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { qtyInStock: { decrement: 2 } },
      });
      expect(mockPrisma.sparepartTxn.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          txnType: 'WITHDRAW',
          txnBy: parcelUser.id,
        }),
      });
    });
  });

  describe('completeAndCloseJob', () => {
    it('should complete job and restore asset status to NORMAL and AVAILABLE', async () => {
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 5, code: 'COMPLETED' });
      mockPrisma.assetStatus.findUnique.mockResolvedValue({ id: 1, code: 'NORMAL' });
      mockPrisma.availabilityStatus.findUnique.mockResolvedValue({ id: 1, code: 'AVAILABLE' });
      mockPrisma.repairJob.update.mockResolvedValue({ id: 'job-uuid-1' });

      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        assetId: 'asset-uuid-1',
        actionType: ActionType.REPAIR,
        jobStatus: { code: 'IN_PROGRESS' },
        repairJobSteps: [
          { stepMaster: { actionType: StepActionType.SELF_REPAIR, stepNumber: 1 } },
        ],
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
