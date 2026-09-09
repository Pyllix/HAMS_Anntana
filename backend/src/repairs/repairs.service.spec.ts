import { Test, TestingModule } from '@nestjs/testing';
import { RepairsService } from './repairs.service';
import { PrismaService } from '../prisma.service';
import { ActionType, ReportType, StepActionType, UrgencyStatus, UserRole } from '@prisma/client';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('RepairsService', () => {
  let service: RepairsService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-uuid-1',
    role: UserRole.MAINTENANCE_STAFF,
    section_id: 'section-uuid-1',
  };

  const mockHeadUser = {
    id: 'head-uuid-1',
    role: UserRole.MAINTENANCE_HEAD,
    section_id: 'section-uuid-1',
  };

  const mockParcelUser = {
    id: 'parcel-uuid-1',
    role: UserRole.PARCEL_STAFF,
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
    assetStatus: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    availabilityStatus: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
      count: jest.fn(),
    },
    sparepart: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    sparepartTxn: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrisma);
      }
      return Promise.all(callback);
    }),
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
    mockPrisma.assetStatus.findUnique.mockResolvedValue({ id: 1, code: 'UNDER_REPAIR' });
    mockPrisma.availabilityStatus.findUnique.mockResolvedValue({ id: 2, code: 'UNAVAILABLE' });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Create Request
  // ───────────────────────────────────────────────────────────────────────────
  describe('createRequest', () => {
    const createDto = {
      assetId: 'asset-uuid-1',
      symptom: 'เครื่องเปิดไม่ติด มีควันขึ้น',
      urgencyStatus: UrgencyStatus.URGENT,
      reportType: ReportType.Repair,
    };

    it('should create repair request and set asset to UNDER_REPAIR and UNAVAILABLE', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-uuid-1',
        section_id: 'section-uuid-1',
        deletedAt: null,
        status: { code: 'NORMAL', name: 'ใช้งานปกติ' },
        availabilityStatus: { code: 'AVAILABLE', name: 'พร้อมใช้งาน' },
      });

      mockPrisma.repairJob.findFirst.mockResolvedValue(null);
      mockPrisma.jobType.findFirst.mockResolvedValue({ id: 1, name: 'ซ่อมเครื่องมือแพทย์' });
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 1, code: 'PENDING_ASSIGN' });
      mockPrisma.asset.update.mockResolvedValue({});
      mockPrisma.repairJob.create.mockResolvedValue({
        id: 'job-uuid-1',
        jobNo: 'REP-202609-0001',
        ...createDto,
      });

      const result = await service.createRequest(createDto, mockUser);

      expect(result.id).toBe('job-uuid-1');
      expect(mockPrisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-uuid-1' },
          data: expect.objectContaining({
            updatedBy: mockUser.id,
          }),
        }),
      );
    });

    it('should throw NotFoundException if asset does not exist', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(service.createRequest(createDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject createRequest if asset already has an active repair job', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-uuid-1',
        status: { code: 'NORMAL' },
      });
      mockPrisma.repairJob.findFirst.mockResolvedValue({
        id: 'active-job',
        jobNo: 'REP-202609-0001',
      });

      await expect(service.createRequest(createDto, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Triage & Dispatch (MAINTENANCE_HEAD)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Triage & Dispatch (assignJob & getMechanicWorkloads)', () => {
    it('should allow MAINTENANCE_HEAD to assign job to multiple technicians', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PENDING_ASSIGN' },
        repairJobSteps: [{ id: 102, stepMaster: { stepNumber: 2 }, completeAt: null }],
      });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 2, name: 'งานไฟฟ้า' });
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'mech-1', role: UserRole.MAINTENANCE_STAFF, firstname: 'A' })
        .mockResolvedValueOnce({ id: 'head-1', role: UserRole.MAINTENANCE_HEAD, firstname: 'B' });
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 2, code: 'IN_PROGRESS' });
      mockPrisma.repairJob.update.mockResolvedValue({ id: 'job-uuid-1', techCategoryId: 2 });

      const result = await service.assignJob(
        'job-uuid-1',
        { techCategoryId: 2, mechanicIds: ['mech-1', 'head-1'] },
        mockHeadUser,
      );

      expect(result.id).toBe('job-uuid-1');
      expect(mockPrisma.mechanicRepair.deleteMany).toHaveBeenCalledWith({ where: { jobId: 'job-uuid-1' } });
      expect(mockPrisma.mechanicRepair.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.repairJobStep.update).toHaveBeenCalled();
    });

    it('should reject assignJob if caller is MAINTENANCE_STAFF (not HEAD)', async () => {
      await expect(
        service.assignJob('job-uuid-1', { techCategoryId: 2, mechanicIds: ['mech-1'] }, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should calculate active job counts in getMechanicWorkloads', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'mech-1', firstname: 'Somchai', lastname: 'Dee', role: UserRole.MAINTENANCE_STAFF },
        { id: 'head-1', firstname: 'Wichai', lastname: 'Head', role: UserRole.MAINTENANCE_HEAD },
      ]);
      mockPrisma.mechanicRepair.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

      const result = await service.getMechanicWorkloads();

      expect(result).toHaveLength(2);
      expect(result[0].activeJobsCount).toBe(3);
      expect(result[1].activeJobsCount).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Ticket Modification (updateRepairRequest)
  // ───────────────────────────────────────────────────────────────────────────
  describe('updateRepairRequest', () => {
    it('should allow reporter to update repair request while PENDING_ASSIGN', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        reporterId: mockUser.id,
        jobStatus: { code: 'PENDING_ASSIGN' },
        symptom: 'อาการเดิม',
      });
      mockPrisma.repairJob.update.mockResolvedValue({
        id: 'job-uuid-1',
        symptom: 'แก้ไขอาการใหม่',
      });

      const result = await service.updateRepairRequest(
        'job-uuid-1',
        { symptom: 'แก้ไขอาการใหม่' },
        mockUser,
      );

      expect(result.symptom).toBe('แก้ไขอาการใหม่');
    });

    it('should reject updateRepairRequest if job has already progressed beyond PENDING_ASSIGN', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        reporterId: mockUser.id,
        jobStatus: { code: 'IN_PROGRESS' },
      });

      await expect(
        service.updateRepairRequest('job-uuid-1', { symptom: 'แก้ไขอาการ' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Diagnose and Plan (4 Tracks)
  // ───────────────────────────────────────────────────────────────────────────
  describe('diagnoseAndPlan', () => {
    it('should validate stock and block WITH_PARTS if INTERNAL spare part quantity is deficient', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PENDING_ASSIGN' },
      });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        role: UserRole.MAINTENANCE_STAFF,
        firstname: 'Somchai',
      });
      mockPrisma.sparepart.findUnique.mockResolvedValue({
        id: 10,
        code: 'SP-001',
        name: 'Battery',
        qtyInStock: 2,
      });

      const dto = {
        diagnosis: 'แบตเตอรี่เสื่อมสภาพ',
        solution: 'เปลี่ยนแบตเตอรี่ใหม่',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.WITH_PARTS,
        spareParts: [{ sparepartId: 10, qty: 5, stockType: 'INTERNAL' as const }],
      };

      await expect(service.diagnoseAndPlan('job-uuid-1', dto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should record PENDING_WITHDRAW transactions with stockType on diagnoseAndPlan for WITH_PARTS', async () => {
      mockPrisma.repairJob.findUnique
        .mockResolvedValueOnce({
          id: 'job-uuid-1',
          jobStatus: { code: 'PENDING_ASSIGN' },
        })
        .mockResolvedValueOnce({
          id: 'job-uuid-1',
          jobStatus: { code: 'WAITING_PARTS' },
          repairJobSteps: [],
          sparepartTxns: [],
        });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        role: UserRole.MAINTENANCE_STAFF,
        firstname: 'Somchai',
      });
      mockPrisma.sparepart.findUnique.mockResolvedValue({
        id: 10,
        price: '500.00',
        qtyInStock: 10,
      });
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 3, code: 'WAITING_PARTS' });
      mockPrisma.stepMaster.findMany.mockResolvedValue([
        { id: 1, stepNumber: 1, actionType: StepActionType.WITH_PARTS, label: 'วันแจ้งซ่อม' },
        { id: 2, stepNumber: 2, actionType: StepActionType.WITH_PARTS, label: 'หัวหน้าช่าง Triage' },
        { id: 3, stepNumber: 3, actionType: StepActionType.WITH_PARTS, label: 'ช่างตรวจเช็ค' },
        { id: 4, stepNumber: 4, actionType: StepActionType.WITH_PARTS, label: 'ขอเบิกอะไหล่' },
      ]);
      mockPrisma.sparepartTxn.findMany.mockResolvedValue([]);
      mockPrisma.repairJob.update.mockResolvedValue({ id: 'job-uuid-1' });

      const dto = {
        diagnosis: 'ลูกปืนแตก',
        solution: 'สั่งซื้อลูกปืนภายนอกและเบิกจาระบี',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.WITH_PARTS,
        spareParts: [{ sparepartId: 10, qty: 2, stockType: 'EXTERNAL' as const }],
      };

      await service.diagnoseAndPlan('job-uuid-1', dto, mockUser);

      expect(mockPrisma.sparepart.update).not.toHaveBeenCalled();
      expect(mockPrisma.sparepartTxn.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sparepartId: 10,
          txnType: 'PENDING_WITHDRAW',
          stockType: 'EXTERNAL',
          qty: 2,
        }),
      });
    });

    it('should require unrepairableReason for UNREPAIRABLE track', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PENDING_ASSIGN' },
      });
      mockPrisma.cause.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.techCategory.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.jobType.findUnique.mockResolvedValue({ id: 1 });

      const dto = {
        diagnosis: 'บอร์ดไหม้ ชิปละลาย',
        solution: 'ซ่อมไม่คุ้ม',
        causeId: 1,
        techCategoryId: 1,
        jobTypeId: 1,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.UNREPAIRABLE,
        // unrepairableReason omitted
      };

      await expect(service.diagnoseAndPlan('job-uuid-1', dto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Update Steps, Batch Handover & Custody Handshake
  // ───────────────────────────────────────────────────────────────────────────
  describe('Step progression & Batch Handover', () => {
    it('should deduct stock and convert PENDING_WITHDRAW to WITHDRAW on Step 6 Batch Handover in WITH_PARTS', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PARCEL_PROCESSING' },
        repairJobSteps: [
          { id: 101, completeAt: new Date(), stepMaster: { stepNumber: 1, actionType: StepActionType.WITH_PARTS } },
          { id: 102, completeAt: new Date(), stepMaster: { stepNumber: 2, actionType: StepActionType.WITH_PARTS } },
          { id: 103, completeAt: new Date(), stepMaster: { stepNumber: 3, actionType: StepActionType.WITH_PARTS } },
          { id: 104, completeAt: new Date(), stepMaster: { stepNumber: 4, actionType: StepActionType.WITH_PARTS } },
          { id: 105, completeAt: new Date(), stepMaster: { stepNumber: 5, actionType: StepActionType.WITH_PARTS } },
          { id: 106, completeAt: null, stepMaster: { stepNumber: 6, actionType: StepActionType.WITH_PARTS, label: 'ช่างรับอะไหล่' } },
          { id: 107, completeAt: null, stepMaster: { stepNumber: 7, actionType: StepActionType.WITH_PARTS } },
          { id: 108, completeAt: null, stepMaster: { stepNumber: 8, actionType: StepActionType.WITH_PARTS } },
        ],
      });
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 2, code: 'IN_PROGRESS' });
      mockPrisma.sparepartTxn.findMany.mockResolvedValue([
        { id: 1, sparepartId: 10, qty: 2, stockType: 'INTERNAL', txnType: 'PENDING_WITHDRAW' },
      ]);
      mockPrisma.sparepart.findUnique.mockResolvedValue({ id: 10, name: 'Battery', qtyInStock: 5 });
      mockPrisma.repairJob.update.mockResolvedValue({});
      mockPrisma.repairJobStep.update.mockResolvedValue({ id: 106, completeAt: new Date() });

      await service.updateStepProgress('job-uuid-1', 6, {}, mockUser);

      expect(mockPrisma.sparepart.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { qtyInStock: { decrement: 2 } },
      });
      expect(mockPrisma.sparepartTxn.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ txnType: 'WITHDRAW', txnBy: mockUser.id }),
      });
    });

    it('should allow PARCEL_STAFF to record companyId in OUTSOURCE track at Step 5 and reject premature billNo', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'PARCEL_PROCESSING' },
        repairJobSteps: [
          { id: 101, completeAt: new Date(), stepMaster: { stepNumber: 1, actionType: StepActionType.OUTSOURCE } },
          { id: 102, completeAt: new Date(), stepMaster: { stepNumber: 2, actionType: StepActionType.OUTSOURCE } },
          { id: 103, completeAt: new Date(), stepMaster: { stepNumber: 3, actionType: StepActionType.OUTSOURCE } },
          { id: 104, completeAt: new Date(), stepMaster: { stepNumber: 4, actionType: StepActionType.OUTSOURCE } },
          { id: 105, completeAt: null, stepMaster: { stepNumber: 5, actionType: StepActionType.OUTSOURCE, label: 'พัสดุส่งบริษัทภายนอกซ่อม' } },
          { id: 106, completeAt: null, stepMaster: { stepNumber: 6, actionType: StepActionType.OUTSOURCE } },
          { id: 107, completeAt: null, stepMaster: { stepNumber: 7, actionType: StepActionType.OUTSOURCE } },
          { id: 108, completeAt: null, stepMaster: { stepNumber: 8, actionType: StepActionType.OUTSOURCE } },
        ],
      });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Vendor A' });
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 5, code: 'OUTSOURCED' });
      mockPrisma.repairJob.update.mockResolvedValue({});
      mockPrisma.repairJobStep.update.mockResolvedValue({ id: 105, completeAt: new Date() });

      // Reject billNo on Step 5
      await expect(
        service.updateStepProgress(
          'job-uuid-1',
          5,
          { billNo: 'INV-1' },
          mockParcelUser,
        ),
      ).rejects.toThrow(BadRequestException);

      // Successfully record companyId on Step 5
      await service.updateStepProgress(
        'job-uuid-1',
        5,
        { companyId: 'comp-1' },
        mockParcelUser,
      );

      expect(mockPrisma.repairJob.update).toHaveBeenCalledWith({
        where: { id: 'job-uuid-1' },
        data: expect.objectContaining({
          companyId: 'comp-1',
        }),
      });
    });

    it('should allow MAINTENANCE_STAFF to record billNo and repairCost in OUTSOURCE track at Step 6 and reject PARCEL_STAFF', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'OUTSOURCED' },
        repairJobSteps: [
          { id: 101, completeAt: new Date(), stepMaster: { stepNumber: 1, actionType: StepActionType.OUTSOURCE } },
          { id: 102, completeAt: new Date(), stepMaster: { stepNumber: 2, actionType: StepActionType.OUTSOURCE } },
          { id: 103, completeAt: new Date(), stepMaster: { stepNumber: 3, actionType: StepActionType.OUTSOURCE } },
          { id: 104, completeAt: new Date(), stepMaster: { stepNumber: 4, actionType: StepActionType.OUTSOURCE } },
          { id: 105, completeAt: new Date(), stepMaster: { stepNumber: 5, actionType: StepActionType.OUTSOURCE } },
          { id: 106, completeAt: null, stepMaster: { stepNumber: 6, actionType: StepActionType.OUTSOURCE, label: 'รับเครื่องคืนและทดสอบ' } },
          { id: 107, completeAt: null, stepMaster: { stepNumber: 7, actionType: StepActionType.OUTSOURCE } },
          { id: 108, completeAt: null, stepMaster: { stepNumber: 8, actionType: StepActionType.OUTSOURCE } },
        ],
      });
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 2, code: 'IN_PROGRESS' });
      mockPrisma.repairJob.update.mockResolvedValue({});
      mockPrisma.repairJobStep.update.mockResolvedValue({ id: 106, completeAt: new Date() });

      // PARCEL_STAFF must be rejected for Step 6 (testing and receiving must be done by maintenance)
      await expect(
        service.updateStepProgress(
          'job-uuid-1',
          6,
          { billNo: 'INV-2026-999', repairCost: 3500 },
          mockParcelUser,
        ),
      ).rejects.toThrow(ForbiddenException);

      // MAINTENANCE_STAFF should be allowed
      await service.updateStepProgress(
        'job-uuid-1',
        6,
        { billNo: 'INV-2026-999', repairCost: 3500 },
        mockUser,
      );

      expect(mockPrisma.repairJob.update).toHaveBeenCalledWith({
        where: { id: 'job-uuid-1' },
        data: expect.objectContaining({
          billNo: 'INV-2026-999',
          repairCost: 3500,
        }),
      });
    });

    it('should allow PARCEL_STAFF to complete unrepairable equipment custody handshake', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        assetId: 'asset-1',
        jobStatus: { code: 'UNREPAIRABLE' },
        asset: { id: 'asset-1', location: 'ห้องตรวจ 101', remark: null },
        repairJobSteps: [
          { id: 105, completeAt: null, stepMaster: { stepNumber: 5 } },
          { id: 106, completeAt: null, stepMaster: { stepNumber: 6 } },
        ],
      });
      mockPrisma.jobStatus.findUnique.mockResolvedValue({ id: 8, code: 'COMPLETED' });
      mockPrisma.assetStatus.findUnique.mockResolvedValue({ id: 4, code: 'WAIT_DISPOSAL' });
      mockPrisma.availabilityStatus.findUnique.mockResolvedValue({ id: 2, code: 'UNAVAILABLE' });
      mockPrisma.repairJob.update.mockResolvedValue({ id: 'job-uuid-1' });

      await service.completeUnrepairable(
        'job-uuid-1',
        { storageLocation: 'คลังพักรอจำหน่าย', note: 'รับมอบเครื่องจริงแล้ว' },
        mockParcelUser,
      );

      expect(mockPrisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: expect.objectContaining({
            asset_status_id: 4,
            availability_status_id: 2,
          }),
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Spare Parts Return (PARCEL_STAFF)
  // ───────────────────────────────────────────────────────────────────────────
  describe('returnSparePart', () => {
    it('should allow PARCEL_STAFF to return unused spare parts and increment stock', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        jobStatus: { code: 'IN_PROGRESS' },
      });
      mockPrisma.sparepart.findUnique.mockResolvedValue({ id: 1, price: '150.00', name: 'IC' });
      mockPrisma.sparepartTxn.findMany
        .mockResolvedValueOnce([{ qty: 3 }])
        .mockResolvedValueOnce([]);
      mockPrisma.sparepartTxn.create.mockResolvedValue({ id: 2, txnType: 'RETURN', qty: 1 });

      await service.returnSparePart('job-uuid-1', { sparepartId: 1, qty: 1 }, mockParcelUser);

      expect(mockPrisma.sparepart.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { qtyInStock: { increment: 1 } },
      });
    });

    it('should reject returning spare parts if caller is not PARCEL_STAFF', async () => {
      await expect(
        service.returnSparePart('job-uuid-1', { sparepartId: 1, qty: 1 }, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. FindOne & Cost Calculation
  // ───────────────────────────────────────────────────────────────────────────
  describe('findOne & Cost Breakdown', () => {
    it('should calculate totalCost including both outsourceCost and sparePartsCost', async () => {
      mockPrisma.repairJob.findUnique.mockResolvedValue({
        id: 'job-uuid-1',
        repairCost: '2500.00',
        dueDate: new Date('2026-09-01'),
        jobStatus: { code: 'COMPLETED' },
        repairJobSteps: [{ completeAt: new Date() }],
        sparepartTxns: [
          { txnType: 'WITHDRAW', qty: 2, unitPrice: '500.00' },
          { txnType: 'RETURN', qty: 1, unitPrice: '500.00' },
        ],
      });

      const result = await service.findOne('job-uuid-1');

      expect(result.summary.outsourceCost).toBe(2500);
      expect(result.summary.totalSparePartsCost).toBe(500);
      expect(result.summary.totalCost).toBe(3000);
    });
  });
});
