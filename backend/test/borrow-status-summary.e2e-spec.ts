import { randomUUID } from 'crypto';
import type { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { Test } from '@nestjs/testing';
import {
  Prisma,
  PrismaClient,
  ActionType,
  ReportType,
  ReturnCondition,
  StepActionType,
  UrgencyStatus,
  UserRole,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import request from 'supertest';
import { PrismaService } from '../src/prisma.service';
import { AssetBorrowController } from '../src/asset-borrow/asset-borrow.controller';
import { AssetBorrowService } from '../src/asset-borrow/asset-borrow.service';
import { AssetController } from '../src/asset/asset.controller';
import { AssetService } from '../src/asset/asset.service';
import { ImageAttachmentService } from '../src/images/image-attachment.service';
import { RepairsController } from '../src/repairs/repairs.controller';
import { RepairsService } from '../src/repairs/repairs.service';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { AdminStepUpService } from '../src/auth/admin-step-up.service';
import { TwoFactorService } from '../src/auth/two-factor.service';
import { ImageReadService } from '../src/images/image-read.service';
import { SparePartsController } from '../src/spare-parts/spare-parts.controller';
import { SparePartsService } from '../src/spare-parts/spare-parts.service';
import { RolesGuard } from '../src/common/guards/roles.guard';

jest.mock('../src/auth/two-factor.service', () => ({
  TwoFactorService: class TwoFactorService {},
}));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

type BorrowListResponse = {
  data: Array<{ id: string; borrowStatus: { code: string } }>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

type BorrowSummaryResponse = {
  total: number;
  byStatusCode: Record<string, number>;
  overdueCount: number;
};

type AssetSummaryResponse = {
  total: number;
  byAssetStatusCode: Record<string, number>;
  byAvailabilityStatusCode: Record<string, number>;
};

type RepairJobListRow = {
  id: string;
  diagnosis?: string | null;
  jobStatus: { code: string };
  repairJobSteps: Array<{
    stepMaster: {
      stepNumber: number;
      actionType: StepActionType;
      label: string;
    };
    user?: { id: string } | null;
  }>;
  asset: {
    status: { code: string };
    availabilityStatus: { code: string };
  };
  sparepartTxns: Array<{ txnType: string; stockType?: string | null }>;
};

type RepairJobListResponse = {
  data: RepairJobListRow[];
  meta: { total: number; totalPages: number };
};

type SparePartListResponse = {
  data: Array<{ qtyInStock: number; minStock: number }>;
  meta: { total: number; totalPages: number };
};

describeWithDatabase('Borrow status summary API (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let userId: string;
  let sectionId: string;
  let outsideSectionId: string;
  let outsideUserId: string;
  let assetId: string;
  let outsideAssetId: string;
  let assetTypeId: number;
  let companyId: string;
  const extraAssetIds: string[] = [];
  const writeFlowBorrowIds: string[] = [];
  let repairJobTypeId: number;
  let repairStepMasterId: number;
  let workflowSparepartGroupId: number;
  let workflowSparepartId: number;
  let mechanicUserId: string;
  let bannedUserId: string;
  const extraUserIds: string[] = [];
  const repairIds: string[] = [];
  const workflowStepMasterIds: number[] = [];
  const workflowSparepartTxnIds: number[] = [];
  let spareApprovalJobId: string;
  let externalSourceApprovalJobId: string;
  let mixedSourceApprovalJobId: string;
  let outsourceApprovalJobId: string;
  let unrepairableHandoverJobId: string;
  let duplicateAssignmentJobId: string;
  let deletedAssignmentJobId: string;
  let completedAssignmentJobId: string;
  const fixturePrefix = `T08-${randomUUID().slice(0, 12)}`;
  const statusCounts: Record<string, number> = {
    PENDING_APPROVE: 3,
    APPROVED: 2,
    BORROWED: 37,
    PENDING_RETURN: 4,
    IN_PICKUP: 1,
    RETURNED: 20,
    REJECTED: 19,
    CANCELLED: 21,
  };
  const repairStatusCounts: Record<string, number> = {
    WAITING_HANDOVER: 3,
    PENDING_ASSIGN: 2,
    IN_PROGRESS: 30,
    WAITING_PARTS: 20,
    PARCEL_PROCESSING: 5,
    OUTSOURCED: 10,
    UNREPAIRABLE: 5,
    WAITING_DELIVERY: 15,
    COMPLETED: 10,
    CANCELLED: 7,
  };

  const server = () => app.getHttpServer() as Server;

  beforeAll(async () => {
    if (!testDatabaseUrl || !/test/i.test(new URL(testDatabaseUrl).pathname)) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated database with "test" in its name',
      );
    }

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
    });
    await prisma.$connect();

    const suffix = randomUUID();
    const section = await prisma.section.create({
      data: { code: `T08-${suffix.slice(0, 8)}`, name: 'Ticket 08 section' },
    });
    sectionId = section.id;
    const user = await prisma.user.create({
      data: {
        id: suffix,
        email: `ticket08-${suffix}@example.test`,
        emailVerified: false,
        firstname: 'Ticket',
        lastname: '08',
        role: UserRole.ASSET_CENTER_STAFF,
        section_id: sectionId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    userId = user.id;

    const outsideSection = await prisma.section.create({
      data: {
        code: `T08-X${suffix.slice(0, 7)}`,
        name: 'Ticket 08 outside section',
      },
    });
    outsideSectionId = outsideSection.id;
    const outsideUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `ticket08-outside-${randomUUID()}@example.test`,
        emailVerified: false,
        firstname: 'Outside',
        lastname: 'Section',
        role: UserRole.DEPARTMENT_STAFF,
        section_id: outsideSectionId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    outsideUserId = outsideUser.id;

    const [assetType, company, assetStatus, availabilityStatus] =
      await Promise.all([
        prisma.assetType.create({
          data: { name: `T08 ${suffix}`, useful_life: 1 },
        }),
        prisma.company.create({
          data: { code: `T08-${suffix.slice(0, 8)}`, name: 'Ticket 08' },
        }),
        prisma.assetStatus.upsert({
          where: { code: 'NORMAL' },
          create: { code: 'NORMAL', name: 'Normal' },
          update: {},
        }),
        prisma.availabilityStatus.upsert({
          where: { code: 'AVAILABLE' },
          create: { code: 'AVAILABLE', name: 'Available' },
          update: {},
        }),
      ]);
    assetTypeId = assetType.id;
    companyId = company.id;

    const asset = await prisma.asset.create({
      data: {
        name: 'Ticket 08 asset',
        model: 'Test model',
        price: new Prisma.Decimal('1.00'),
        receivedDate: new Date('2026-01-01T00:00:00.000Z'),
        type_id: assetTypeId,
        section_id: sectionId,
        company_id: companyId,
        asset_status_id: assetStatus.id,
        availability_status_id: availabilityStatus.id,
        owner_id: userId,
        createdBy: userId,
        updatedBy: userId,
      },
    });
    assetId = asset.id;
    const outsideAsset = await prisma.asset.create({
      data: {
        name: 'Ticket 08 outside asset',
        model: 'Test model',
        price: new Prisma.Decimal('1.00'),
        receivedDate: new Date('2026-01-01T00:00:00.000Z'),
        type_id: assetTypeId,
        section_id: outsideSectionId,
        company_id: companyId,
        asset_status_id: assetStatus.id,
        availability_status_id: availabilityStatus.id,
        owner_id: outsideUserId,
        createdBy: outsideUserId,
        updatedBy: outsideUserId,
      },
    });
    outsideAssetId = outsideAsset.id;

    const assetStatusIds = new Map(
      await Promise.all(
        ['NORMAL', 'DAMAGED', 'WAIT_DISPOSAL'].map(async (code) => {
          const status = await prisma.assetStatus.upsert({
            where: { code },
            create: { code, name: code },
            update: {},
          });
          return [code, status.id] as const;
        }),
      ),
    );
    const availabilityStatusIds = new Map(
      await Promise.all(
        ['AVAILABLE', 'UNAVAILABLE'].map(async (code) => {
          const status = await prisma.availabilityStatus.upsert({
            where: { code },
            create: { code, name: code },
            update: {},
          });
          return [code, status.id] as const;
        }),
      ),
    );
    const extraAssetData = [
      ...Array.from({ length: 40 }, (_, index) => ({
        statusCode: 'NORMAL',
        availabilityCode: 'AVAILABLE',
        updatedAt: new Date('2026-10-01T10:00:00.000Z'),
        index,
      })),
      ...Array.from({ length: 30 }, (_, index) => ({
        statusCode: 'DAMAGED',
        availabilityCode: 'UNAVAILABLE',
        updatedAt: new Date('2026-10-01T10:00:00.000Z'),
        index,
      })),
      ...Array.from({ length: 36 }, (_, index) => ({
        statusCode: 'WAIT_DISPOSAL',
        availabilityCode: 'UNAVAILABLE',
        updatedAt:
          index < 2
            ? new Date('2026-01-15T12:00:00.000Z')
            : new Date('2026-10-01T10:00:00.000Z'),
        index,
      })),
    ].map(({ statusCode, availabilityCode, updatedAt, index }) => ({
      id: randomUUID(),
      name: `Ticket 08 asset ${statusCode} ${index}`,
      model: 'Test model',
      price: new Prisma.Decimal('1.00'),
      receivedDate: new Date('2026-01-01T00:00:00.000Z'),
      type_id: assetTypeId,
      section_id: sectionId,
      company_id: companyId,
      asset_status_id: assetStatusIds.get(statusCode)!,
      availability_status_id: availabilityStatusIds.get(availabilityCode)!,
      owner_id: userId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt,
    }));
    extraAssetIds.push(...extraAssetData.map(({ id }) => id));
    await prisma.asset.createMany({ data: extraAssetData });

    const statusRows = await Promise.all(
      Object.keys(statusCounts).map((code) =>
        prisma.borrowStatus.upsert({
          where: { code },
          create: { code, name: code },
          update: {},
        }),
      ),
    );
    const statusIdByCode = new Map(
      statusRows.map(({ id, code }) => [code, id]),
    );
    const createdAt = new Date('2026-10-01T10:00:00.000Z');
    const transactions = Object.entries(statusCounts).flatMap(([code, count]) =>
      Array.from({ length: count }, (_, index) => ({
        id: randomUUID(),
        borrowNo: `${fixturePrefix}-${code}-${String(index).padStart(3, '0')}`,
        asset_id: assetId,
        borrower_id: userId,
        created_by_user_id: userId,
        borrow_status_id: statusIdByCode.get(code)!,
        expectedReturnDate:
          code === 'BORROWED' && index === 0
            ? new Date(Date.now() - 24 * 60 * 60 * 1000)
            : null,
        createdAt,
      })),
    );
    await prisma.borrowTransaction.createMany({ data: transactions });
    await prisma.borrowTransaction.create({
      data: {
        borrowNo: `${fixturePrefix}-OUTSIDE`,
        asset_id: outsideAssetId,
        borrower_id: outsideUserId,
        created_by_user_id: outsideUserId,
        borrow_status_id: statusIdByCode.get('APPROVED')!,
      },
    });

    const mechanic = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `ticket08-mechanic-${randomUUID()}@example.test`,
        emailVerified: false,
        firstname: 'Ticket',
        lastname: 'Mechanic',
        role: UserRole.MAINTENANCE_STAFF,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    mechanicUserId = mechanic.id;
    const bannedUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `ticket08-banned-${randomUUID()}@example.test`,
        emailVerified: false,
        firstname: 'Banned',
        lastname: 'Tester',
        role: UserRole.PARCEL_STAFF,
        banned: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    bannedUserId = bannedUser.id;
    const extraUsers = Array.from({ length: 105 }, (_, index) => ({
      id: randomUUID(),
      email: `ticket08-pagination-${randomUUID()}@example.test`,
      emailVerified: false,
      firstname: 'Ticket 08 Pagination',
      lastname: `User ${index}`,
      role: UserRole.PARCEL_STAFF,
      banned: false,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    }));
    await prisma.user.createMany({ data: extraUsers });
    extraUserIds.push(...extraUsers.map(({ id }) => id));
    const jobType = await prisma.jobType.create({
      data: { name: `Ticket 08 repair ${randomUUID()}` },
    });
    repairJobTypeId = jobType.id;
    const stepMaster = await prisma.stepMaster.create({
      data: {
        stepNumber: 1,
        actionType: StepActionType.SELF_REPAIR,
        label: 'Ticket 08 evaluated',
      },
    });
    repairStepMasterId = stepMaster.id;
    const jobStatusRows = await Promise.all(
      Object.keys(repairStatusCounts).map((code) =>
        prisma.jobStatus.upsert({
          where: { code },
          create: { code, name: code },
          update: {},
        }),
      ),
    );
    const jobStatusIdByCode = new Map(
      jobStatusRows.map(({ id, code }) => [code, id]),
    );
    const stepMasterIds = new Map<string, number>();
    async function getWorkflowStepMaster(
      actionType: StepActionType,
      stepNumber: number,
    ) {
      const key = `${actionType}-${stepNumber}`;
      const existing = stepMasterIds.get(key);
      if (existing) return existing;
      const created = await prisma.stepMaster.create({
        data: {
          stepNumber,
          actionType,
          label: `${actionType} ${stepNumber}`,
        },
      });
      stepMasterIds.set(key, created.id);
      workflowStepMasterIds.push(created.id);
      return created.id;
    }
    async function createWorkflowJob(input: {
      key: string;
      actionType: StepActionType;
      statusCode: string;
      completedSteps: number[];
      rejectedStep?: number;
    }) {
      const job = await prisma.repairJob.create({
        data: {
          jobNo: `${fixturePrefix}-WF-${input.key}`,
          assetId: outsideAssetId,
          sectionId: outsideSectionId,
          reporterId: outsideUserId,
          jobTypeId: repairJobTypeId,
          reportType: ReportType.Repair,
          jobStatusId: jobStatusIdByCode.get(input.statusCode)!,
          urgencyStatus: UrgencyStatus.NORMAL,
          createdBy: outsideUserId,
          updatedBy: outsideUserId,
        },
      });
      repairIds.push(job.id);
      const stepNumbers = new Set([
        ...input.completedSteps,
        ...(input.rejectedStep ? [input.rejectedStep] : []),
      ]);
      const stepData = await Promise.all(
        [...stepNumbers].map(async (stepNumber) => ({
          jobId: job.id,
          stepMasterId: await getWorkflowStepMaster(
            input.actionType,
            stepNumber,
          ),
          completeAt: input.completedSteps.includes(stepNumber)
            ? new Date('2026-10-01T12:00:00.000Z')
            : null,
          note:
            input.rejectedStep === stepNumber
              ? '[ไม่อนุมัติ] test rejection'
              : null,
          completedBy: input.completedSteps.includes(stepNumber)
            ? outsideUserId
            : null,
        })),
      );
      await prisma.repairJobStep.createMany({ data: stepData });
      return job;
    }

    const workflowPartGroup = await prisma.sparepartGroup.create({
      data: { name: `Ticket 08 workflow ${randomUUID()}` },
    });
    workflowSparepartGroupId = workflowPartGroup.id;
    const workflowPart = await prisma.sparepart.create({
      data: {
        code: `T08-${randomUUID()}`,
        name: 'Workflow pending part',
        price: new Prisma.Decimal('2.00'),
        groupId: workflowSparepartGroupId,
        qtyInStock: 5,
      },
    });
    workflowSparepartId = workflowPart.id;

    const spareApproval = await createWorkflowJob({
      key: 'SPARE-APPROVAL',
      actionType: StepActionType.WITH_PARTS,
      statusCode: 'IN_PROGRESS',
      completedSteps: [1, 4],
    });
    spareApprovalJobId = spareApproval.id;
    const spareApprovalBeyondStage = await createWorkflowJob({
      key: 'SPARE-PAST-APPROVAL',
      actionType: StepActionType.WITH_PARTS,
      statusCode: 'WAITING_PARTS',
      completedSteps: [1, 4, 5],
    });
    const spareApprovalWithoutParts = await createWorkflowJob({
      key: 'SPARE-NO-PENDING-PART',
      actionType: StepActionType.WITH_PARTS,
      statusCode: 'IN_PROGRESS',
      completedSteps: [1, 4],
    });
    const externalSourceApproval = await createWorkflowJob({
      key: 'SPARE-EXTERNAL-SOURCE',
      actionType: StepActionType.WITH_PARTS,
      statusCode: 'IN_PROGRESS',
      completedSteps: [1, 4],
    });
    externalSourceApprovalJobId = externalSourceApproval.id;
    const mixedSourceApproval = await createWorkflowJob({
      key: 'SPARE-MIXED-SOURCE',
      actionType: StepActionType.WITH_PARTS,
      statusCode: 'IN_PROGRESS',
      completedSteps: [1, 4],
    });
    mixedSourceApprovalJobId = mixedSourceApproval.id;
    const crossTrackPastApproval = await createWorkflowJob({
      key: 'SPARE-CROSS-TRACK-PAST-APPROVAL',
      actionType: StepActionType.WITH_PARTS,
      statusCode: 'WAITING_PARTS',
      completedSteps: [1, 4],
    });
    const outsourceStepFiveId = await getWorkflowStepMaster(
      StepActionType.OUTSOURCE,
      5,
    );
    await prisma.repairJobStep.create({
      data: {
        jobId: crossTrackPastApproval.id,
        stepMasterId: outsourceStepFiveId,
        completeAt: new Date('2026-10-01T11:00:00.000Z'),
        completedBy: outsideUserId,
      },
    });
    for (const jobId of [spareApproval.id, spareApprovalBeyondStage.id]) {
      const txn = await prisma.sparepartTxn.create({
        data: {
          sparepartId: workflowSparepartId,
          jobId,
          txnType: 'PENDING_WITHDRAW',
          stockType: 'INTERNAL',
          qty: 1,
          unitPrice: new Prisma.Decimal('2.00'),
          txnBy: outsideUserId,
        },
      });
      workflowSparepartTxnIds.push(txn.id);
    }
    const sourceTransactions = await Promise.all(
      [
        {
          sparepartId: workflowSparepartId,
          jobId: externalSourceApprovalJobId,
          txnType: 'PENDING_WITHDRAW',
          stockType: 'EXTERNAL',
          qty: 1,
          unitPrice: new Prisma.Decimal('2.00'),
          txnBy: outsideUserId,
        },
        {
          sparepartId: workflowSparepartId,
          jobId: mixedSourceApprovalJobId,
          txnType: 'PENDING_WITHDRAW',
          stockType: 'INTERNAL',
          qty: 1,
          unitPrice: new Prisma.Decimal('2.00'),
          txnBy: outsideUserId,
        },
        {
          sparepartId: workflowSparepartId,
          jobId: crossTrackPastApproval.id,
          txnType: 'PENDING_WITHDRAW',
          stockType: 'INTERNAL',
          qty: 1,
          unitPrice: new Prisma.Decimal('2.00'),
          txnBy: outsideUserId,
        },
        {
          sparepartId: workflowSparepartId,
          jobId: mixedSourceApprovalJobId,
          txnType: 'PENDING_WITHDRAW',
          stockType: 'EXTERNAL',
          qty: 1,
          unitPrice: new Prisma.Decimal('2.00'),
          txnBy: outsideUserId,
        },
      ].map((data) => prisma.sparepartTxn.create({ data })),
    );
    workflowSparepartTxnIds.push(...sourceTransactions.map(({ id }) => id));
    const outsourceApproval = await createWorkflowJob({
      key: 'OUTSOURCE-APPROVAL',
      actionType: StepActionType.OUTSOURCE,
      statusCode: 'IN_PROGRESS',
      completedSteps: [1, 4],
    });
    outsourceApprovalJobId = outsourceApproval.id;
    await createWorkflowJob({
      key: 'OUTSOURCE-REJECTED',
      actionType: StepActionType.OUTSOURCE,
      statusCode: 'IN_PROGRESS',
      completedSteps: [1, 4],
      rejectedStep: 5,
    });
    const unrepairableHandover = await createWorkflowJob({
      key: 'UNREPAIRABLE-HANDED-OVER',
      actionType: StepActionType.UNREPAIRABLE,
      statusCode: 'UNREPAIRABLE',
      completedSteps: [1, 2, 3, 4, 5],
    });
    unrepairableHandoverJobId = unrepairableHandover.id;
    await createWorkflowJob({
      key: 'UNREPAIRABLE-WAITING-HANDOVER',
      actionType: StepActionType.UNREPAIRABLE,
      statusCode: 'UNREPAIRABLE',
      completedSteps: [1, 2, 3, 4],
    });

    const repairRows = Object.entries(repairStatusCounts).flatMap(
      ([code, count]) =>
        Array.from({ length: count }, (_, index) => {
          const id = randomUUID();
          repairIds.push(id);
          if (code === 'IN_PROGRESS' && index === 0) {
            duplicateAssignmentJobId = id;
          }
          if (code === 'IN_PROGRESS' && index === 1) {
            deletedAssignmentJobId = id;
          }
          if (code === 'COMPLETED' && index === 0) {
            completedAssignmentJobId = id;
          }
          return {
            id,
            jobNo: `${fixturePrefix}-RJ-${code}-${String(index).padStart(3, '0')}`,
            assetId,
            sectionId,
            reporterId: userId,
            jobTypeId: repairJobTypeId,
            reportType: ReportType.Repair,
            jobStatusId: jobStatusIdByCode.get(code)!,
            urgencyStatus: UrgencyStatus.NORMAL,
            diagnosis:
              code === 'IN_PROGRESS' && index < 3 ? `Evaluated ${index}` : null,
            createdBy: userId,
            updatedBy: userId,
            createdAt: new Date('2026-10-01T10:00:00.000Z'),
            updatedAt: new Date('2026-10-01T10:00:00.000Z'),
          };
        }),
    );
    await prisma.repairJob.createMany({ data: repairRows });
    const outsideRepair = await prisma.repairJob.create({
      data: {
        jobNo: `${fixturePrefix}-RJ-OUTSIDE`,
        assetId: outsideAssetId,
        sectionId: outsideSectionId,
        reporterId: outsideUserId,
        jobTypeId: repairJobTypeId,
        reportType: ReportType.Repair,
        jobStatusId: jobStatusIdByCode.get('CANCELLED')!,
        urgencyStatus: UrgencyStatus.NORMAL,
        createdBy: outsideUserId,
        updatedBy: outsideUserId,
      },
    });
    repairIds.push(outsideRepair.id);
    await prisma.repairJobStep.create({
      data: {
        jobId: duplicateAssignmentJobId,
        stepMasterId: repairStepMasterId,
        completeAt: new Date('2026-10-01T11:00:00.000Z'),
        note: 'Evaluation complete',
        completedBy: userId,
      },
    });
    await prisma.mechanicRepair.createMany({
      data: [
        { jobId: duplicateAssignmentJobId, userId: mechanicUserId },
        { jobId: duplicateAssignmentJobId, userId: mechanicUserId },
        {
          jobId: deletedAssignmentJobId,
          userId: mechanicUserId,
          deleteAt: new Date(),
        },
        { jobId: completedAssignmentJobId, userId: mechanicUserId },
      ],
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [
        AssetBorrowController,
        AssetController,
        RepairsController,
        UsersController,
        SparePartsController,
      ],
      providers: [
        AssetBorrowService,
        AssetService,
        RepairsService,
        UsersService,
        SparePartsService,
        {
          provide: ImageAttachmentService,
          useValue: { assertAttachmentPayload: jest.fn() },
        },
        {
          provide: ImageReadService,
          useValue: { projectUser: (user: unknown) => user },
        },
        { provide: AdminStepUpService, useValue: {} },
        { provide: TwoFactorService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new RolesGuard(moduleRef.get(Reflector)));
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const testRequest = req as Request & {
        user?: { id: string; role: UserRole; section_id: string };
        session?: {
          user: { id: string; role: UserRole; section_id: string };
          session: { id: string };
        };
      };
      const role =
        req.headers['x-e2e-role'] === 'department'
          ? UserRole.DEPARTMENT_STAFF
          : req.headers['x-e2e-role'] === 'admin'
            ? UserRole.ADMIN
            : req.headers['x-e2e-role'] === 'mechanic'
              ? UserRole.MAINTENANCE_HEAD
              : req.headers['x-e2e-role'] === 'parcel'
                ? UserRole.PARCEL_STAFF
                : UserRole.ASSET_CENTER_STAFF;
      testRequest.user = {
        id: role === UserRole.MAINTENANCE_HEAD ? mechanicUserId : userId,
        role,
        section_id: sectionId,
      };
      testRequest.session = {
        user: testRequest.user,
        session: { id: `ticket-08-${fixturePrefix}` },
      };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (prisma) {
      if (writeFlowBorrowIds.length > 0) {
        await prisma.borrowTransaction.deleteMany({
          where: { id: { in: writeFlowBorrowIds } },
        });
      }
      await prisma.borrowTransaction.deleteMany({
        where: { borrowNo: { startsWith: fixturePrefix } },
      });
      if (repairIds.length > 0) {
        await prisma.sparepartTxn.deleteMany({
          where: { jobId: { in: repairIds } },
        });
      }
      if (workflowSparepartTxnIds.length > 0) {
        await prisma.sparepartTxn.deleteMany({
          where: { id: { in: workflowSparepartTxnIds } },
        });
      }
      if (repairIds.length > 0) {
        await prisma.repairJob.deleteMany({ where: { id: { in: repairIds } } });
      }
      if (repairJobTypeId) {
        await prisma.jobType.deleteMany({ where: { id: repairJobTypeId } });
      }
      if (repairStepMasterId) {
        await prisma.stepMaster.deleteMany({
          where: { id: repairStepMasterId },
        });
      }
      if (workflowStepMasterIds.length > 0) {
        await prisma.stepMaster.deleteMany({
          where: { id: { in: workflowStepMasterIds } },
        });
      }
      if (workflowSparepartId) {
        await prisma.sparepart.deleteMany({
          where: { id: workflowSparepartId },
        });
      }
      if (workflowSparepartGroupId) {
        await prisma.sparepartGroup.deleteMany({
          where: { id: workflowSparepartGroupId },
        });
      }
      const assetIds = [assetId, outsideAssetId, ...extraAssetIds].filter(
        (id): id is string => Boolean(id),
      );
      if (assetIds.length > 0) {
        await prisma.asset.deleteMany({ where: { id: { in: assetIds } } });
      }
      if (assetTypeId) {
        await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
      }
      if (companyId)
        await prisma.company.deleteMany({ where: { id: companyId } });
      if (userId) await prisma.user.deleteMany({ where: { id: userId } });
      if (outsideUserId) {
        await prisma.user.deleteMany({ where: { id: outsideUserId } });
      }
      if (mechanicUserId) {
        await prisma.user.deleteMany({ where: { id: mechanicUserId } });
      }
      if (bannedUserId) {
        await prisma.user.deleteMany({ where: { id: bannedUserId } });
      }
      if (extraUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
      }
      if (sectionId)
        await prisma.section.deleteMany({ where: { id: sectionId } });
      if (outsideSectionId) {
        await prisma.section.deleteMany({ where: { id: outsideSectionId } });
      }
      await prisma.$disconnect();
    }
  });

  it('returns exact per-status counts for every matching row, independent of page size', async () => {
    const response = await request(server())
      .get('/borrowings/summary')
      .query({ sectionId })
      .expect(200);
    const body = response.body as BorrowSummaryResponse;

    expect(body.total).toBe(107);
    expect(body.byStatusCode).toEqual(statusCounts);
    expect(body.byStatusCode.PENDING_APPROVAL).toBeUndefined();
    expect(body.byStatusCode.PENDING_APPROVE + body.byStatusCode.APPROVED).toBe(
      5,
    );
    expect(body.byStatusCode.PENDING_RETURN).toBe(4);
    expect(body.byStatusCode.IN_PICKUP).toBe(1);
    expect(body.overdueCount).toBe(1);

    const departmentScope = await request(server())
      .get('/borrowings/summary')
      .query({ sectionId: outsideSectionId })
      .set('x-e2e-role', 'department')
      .expect(200);
    expect(departmentScope.body.total).toBe(107);
    expect(departmentScope.body.byStatusCode.APPROVED).toBe(2);
  });

  it('filters the table by status codes before paging and keeps pages complete and stable', async () => {
    const firstPage = (
      await request(server())
        .get('/borrowings')
        .query({
          statusCodes: 'PENDING_APPROVE,APPROVED',
          sectionId,
          page: 1,
          limit: 2,
        })
        .expect(200)
    ).body as BorrowListResponse;
    const secondPage = (
      await request(server())
        .get('/borrowings')
        .query({
          statusCodes: 'PENDING_APPROVE,APPROVED',
          sectionId,
          page: 2,
          limit: 2,
        })
        .expect(200)
    ).body as BorrowListResponse;
    const thirdPage = (
      await request(server())
        .get('/borrowings')
        .query({
          statusCodes: 'PENDING_APPROVE,APPROVED',
          sectionId,
          page: 3,
          limit: 2,
        })
        .expect(200)
    ).body as BorrowListResponse;

    const allMatchingIds = [
      ...firstPage.data,
      ...secondPage.data,
      ...thirdPage.data,
    ].map(({ id }) => id);
    expect(new Set(allMatchingIds).size).toBe(5);
    expect(firstPage.meta).toMatchObject({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: false,
    });
    expect(secondPage.meta).toMatchObject({
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    });
    expect(thirdPage.meta).toMatchObject({
      page: 3,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: false,
      hasPrevPage: true,
    });
    expect(
      [...firstPage.data, ...secondPage.data, ...thirdPage.data].every((row) =>
        ['PENDING_APPROVE', 'APPROVED'].includes(row.borrowStatus.code),
      ),
    ).toBe(true);

    const all = (
      await request(server())
        .get('/borrowings')
        .query({
          statusCodes: 'PENDING_APPROVE,APPROVED',
          sectionId,
          limit: 100,
        })
        .expect(200)
    ).body as BorrowListResponse;
    expect(all.meta.total).toBe(5);
    expect(all.data.map(({ id }) => id)).toEqual(allMatchingIds);
  });

  it('returns zero rows for an unknown status code instead of dropping the filter', async () => {
    const response = (
      await request(server())
        .get('/borrowings')
        .query({ statusCodes: 'NOT_A_REAL_STATUS' })
        .expect(200)
    ).body as BorrowListResponse;

    expect(response.data).toEqual([]);
    expect(response.meta.total).toBe(0);
  });

  it('summarizes asset and availability statuses from the full database scope', async () => {
    const response = await request(server()).get('/asset/summary').expect(200);

    expect(response.body).toMatchObject({
      total: 108,
      byAssetStatusCode: {
        NORMAL: 42,
        DAMAGED: 30,
        WAIT_DISPOSAL: 36,
      },
      byAvailabilityStatusCode: {
        AVAILABLE: 42,
        UNAVAILABLE: 66,
      },
    });

    const departmentResponse = await request(server())
      .get('/asset/summary')
      .query({ section_id: outsideSectionId })
      .set('x-e2e-role', 'department')
      .expect(200);
    const departmentSummary = departmentResponse.body as AssetSummaryResponse;
    expect(departmentSummary.total).toBe(107);
    expect(departmentSummary.byAssetStatusCode).toEqual({
      NORMAL: 41,
      DAMAGED: 30,
      WAIT_DISPOSAL: 36,
    });
  });

  it('filters assets by status code before pagination and supports my-section filters', async () => {
    const damaged = await request(server())
      .get('/asset')
      .query({ assetStatusCode: 'DAMAGED', page: 1, limit: 10 })
      .expect(200);
    expect(damaged.body.meta).toMatchObject({ total: 30, totalPages: 3 });
    expect(damaged.body.data).toHaveLength(10);
    const damagedRows = damaged.body.data as Array<{
      status: { code: string };
    }>;
    expect(damagedRows.every((row) => row.status.code === 'DAMAGED')).toBe(
      true,
    );

    const mySection = await request(server())
      .get('/asset/my-section')
      .query({ assetStatusCode: 'WAIT_DISPOSAL', limit: 100 })
      .expect(200);
    expect(mySection.body.meta.total).toBe(36);
    expect(mySection.body.data).toHaveLength(36);

    const availableToBorrow = await request(server())
      .get('/asset/my-section')
      .query({
        assetStatusCode: 'NORMAL',
        availabilityStatusCode: 'AVAILABLE',
        limit: 100,
      })
      .expect(200);
    expect(availableToBorrow.body.meta.total).toBe(41);
    expect(availableToBorrow.body.data).toHaveLength(41);
    expect(
      availableToBorrow.body.data.every(
        (row: {
          status: { code: string };
          availabilityStatus: { code: string };
        }) =>
          row.status.code === 'NORMAL' &&
          row.availabilityStatus.code === 'AVAILABLE',
      ),
    ).toBe(true);

    const guardedMySection = await request(server())
      .get('/asset/my-section')
      .query({
        section_id: outsideSectionId,
        assetStatusCode: 'NORMAL',
        limit: 100,
      })
      .expect(200);
    expect(guardedMySection.body.meta.total).toBe(41);

    const mySectionSummary = await request(server())
      .get('/asset/my-section/summary')
      .expect(200);
    expect(mySectionSummary.body).toMatchObject({
      total: 107,
      byAssetStatusCode: { NORMAL: 41, DAMAGED: 30, WAIT_DISPOSAL: 36 },
    });
  });

  it('applies explicit-offset updatedAt ranges before page and count', async () => {
    const firstPage = await request(server())
      .get('/asset')
      .query({
        assetStatusCode: 'WAIT_DISPOSAL',
        updatedAtFrom: '2026-01-15T00:00:00+00:00',
        updatedAtTo: '2026-01-15T23:59:59.999+00:00',
        page: 1,
        limit: 1,
      })
      .expect(200);
    const secondPage = await request(server())
      .get('/asset')
      .query({
        assetStatusCode: 'WAIT_DISPOSAL',
        updatedAtFrom: '2026-01-15T00:00:00+00:00',
        updatedAtTo: '2026-01-15T23:59:59.999+00:00',
        page: 2,
        limit: 1,
      })
      .expect(200);

    expect(firstPage.body.meta).toMatchObject({ total: 2, totalPages: 2 });
    expect(secondPage.body.meta).toMatchObject({ total: 2, totalPages: 2 });
    expect(firstPage.body.data[0].id).not.toBe(secondPage.body.data[0].id);

    await request(server())
      .get('/asset')
      .query({ updatedAtFrom: '2026-01-15' })
      .expect(400);
  });

  it('returns exact repair status counts and database-filters multi-status pages', async () => {
    const summary = await request(server())
      .get('/repairs/summary')
      .query({ sectionId })
      .expect(200);
    expect(summary.body).toMatchObject({
      total: 107,
      byStatusCode: repairStatusCounts,
    });

    await request(server())
      .get('/repairs/summary')
      .query({ evaluatedOnly: 'not-a-boolean' })
      .expect(400);

    const departmentSummary = await request(server())
      .get('/repairs/summary')
      .query({ sectionId: outsideSectionId })
      .set('x-e2e-role', 'department')
      .expect(200);
    expect(departmentSummary.body.total).toBe(107);
    expect(departmentSummary.body.byStatusCode.CANCELLED).toBe(7);

    const page = await request(server())
      .get('/repairs')
      .query({
        statusCodes: 'WAITING_DELIVERY,COMPLETED',
        page: 2,
        limit: 10,
      })
      .expect(200);
    expect(page.body.meta).toMatchObject({ total: 25, totalPages: 3 });
    expect(page.body.data).toHaveLength(10);
    const repairPage = page.body as RepairJobListResponse;
    expect(
      repairPage.data.every((job) =>
        ['WAITING_DELIVERY', 'COMPLETED'].includes(job.jobStatus.code),
      ),
    ).toBe(true);

    const evaluated = await request(server())
      .get('/repairs')
      .query({ evaluatedOnly: true, limit: 100 })
      .expect(200);
    expect(evaluated.body.meta.total).toBe(3);
    const evaluatedJobs = evaluated.body.data as Array<{
      diagnosis?: string | null;
    }>;
    expect(evaluatedJobs.every((job) => Boolean(job.diagnosis))).toBe(true);

    const evaluatedPage = await request(server())
      .get('/repairs')
      .query({ statusCodes: 'IN_PROGRESS', evaluatedOnly: true, limit: 100 })
      .expect(200);

    const mechanicSearch = await request(server())
      .get('/repairs')
      .query({ search: 'Mechanic', limit: 100 })
      .expect(200);
    const mechanicSearchIds = mechanicSearch.body.data.map(
      (job: { id: string }) => job.id,
    );
    expect(mechanicSearchIds).toEqual(
      expect.arrayContaining([
        duplicateAssignmentJobId,
        completedAssignmentJobId,
      ]),
    );
    expect(mechanicSearchIds).not.toContain(deletedAssignmentJobId);
    const evaluatedPageBody = evaluatedPage.body as RepairJobListResponse;
    const projectedJob = evaluatedPageBody.data.find(
      (job) => job.id === duplicateAssignmentJobId,
    );
    if (!projectedJob) throw new Error('Missing projected repair fixture');
    expect(projectedJob.repairJobSteps[0]).toMatchObject({
      stepMaster: {
        stepNumber: 1,
        actionType: 'SELF_REPAIR',
        label: 'Ticket 08 evaluated',
      },
      user: { id: userId },
    });
    expect(projectedJob.asset).toMatchObject({
      status: { code: 'NORMAL' },
      availabilityStatus: { code: 'AVAILABLE' },
    });

    const departmentList = await request(server())
      .get('/repairs')
      .query({
        sectionId: outsideSectionId,
        statusCodes: 'CANCELLED',
        limit: 100,
      })
      .set('x-e2e-role', 'department')
      .expect(200);
    expect(departmentList.body.meta.total).toBe(7);
  });

  it('returns unique active workload counts per mechanic from the database', async () => {
    const response = await request(server())
      .get('/repairs/mechanic-workloads')
      .set('x-e2e-role', 'admin')
      .expect(200);
    const workloads = response.body as Array<{
      id: string;
      activeJobsCount: number;
    }>;
    const mechanic = workloads.find((item) => item.id === mechanicUserId);

    if (!mechanic) throw new Error('Missing mechanic workload fixture');
    expect(mechanic.activeJobsCount).toBe(1);
  });

  it('filters repair workflow approval and handover queues before pagination', async () => {
    const spareApprovals = await request(server())
      .get('/repairs')
      .query({
        stepActionType: StepActionType.WITH_PARTS,
        workflowStep: 4,
        hasPendingSparepartWithdrawal: true,
        sparepartSource: 'INTERNAL',
        limit: 1,
      })
      .expect(200);
    expect(spareApprovals.body.meta.total).toBe(1);
    expect(spareApprovals.body.data[0].id).toBe(spareApprovalJobId);
    expect(
      (spareApprovals.body as RepairJobListResponse).data[0].sparepartTxns.some(
        (txn) => txn.txnType === 'PENDING_WITHDRAW',
      ),
    ).toBe(true);

    const searchedInternalApproval = await request(server())
      .get('/repairs')
      .query({
        stepActionType: StepActionType.WITH_PARTS,
        workflowStep: 4,
        hasPendingSparepartWithdrawal: true,
        sparepartSource: 'INTERNAL',
        search: 'Workflow pending part',
        limit: 1,
      })
      .expect(200);
    expect(searchedInternalApproval.body.meta.total).toBe(1);
    expect(searchedInternalApproval.body.data[0].id).toBe(spareApprovalJobId);

    const externalApproval = await request(server())
      .get('/repairs')
      .query({
        stepActionType: StepActionType.WITH_PARTS,
        workflowStep: 4,
        hasPendingSparepartWithdrawal: true,
        sparepartSource: 'EXTERNAL',
        limit: 1,
      })
      .expect(200);
    expect(externalApproval.body.meta.total).toBe(1);
    expect(externalApproval.body.data[0].id).toBe(externalSourceApprovalJobId);

    const mixedApproval = await request(server())
      .get('/repairs')
      .query({
        stepActionType: StepActionType.WITH_PARTS,
        workflowStep: 4,
        hasPendingSparepartWithdrawal: true,
        sparepartSource: 'MIXED',
        limit: 1,
      })
      .expect(200);
    expect(mixedApproval.body.meta.total).toBe(1);
    expect(mixedApproval.body.data[0].id).toBe(mixedSourceApprovalJobId);

    const outsourceApprovals = await request(server())
      .get('/repairs')
      .query({
        stepActionType: StepActionType.OUTSOURCE,
        workflowStep: 4,
        isRejected: false,
        limit: 1,
      })
      .expect(200);
    expect(outsourceApprovals.body.meta.total).toBe(1);
    expect(outsourceApprovals.body.data[0].id).toBe(outsourceApprovalJobId);

    const unrepairableReceipts = await request(server())
      .get('/repairs')
      .query({
        statusCode: 'UNREPAIRABLE',
        stepActionType: StepActionType.UNREPAIRABLE,
        workflowStep: 5,
        limit: 1,
      })
      .expect(200);
    expect(unrepairableReceipts.body.meta.total).toBe(1);
    expect(unrepairableReceipts.body.data[0].id).toBe(
      unrepairableHandoverJobId,
    );
  });

  it('filters user search, role, and banned status before pagination', async () => {
    const banned = await request(server())
      .get('/users')
      .query({ banned: true, limit: 1 })
      .expect(200);
    expect(banned.body.meta).toMatchObject({ total: 1, totalPages: 1 });
    expect(banned.body.data.map(({ id }: { id: string }) => id)).toEqual([
      bannedUserId,
    ]);

    const activeMechanics = await request(server())
      .get('/users')
      .query({
        banned: false,
        role: UserRole.MAINTENANCE_STAFF,
        search: 'Ticket',
        limit: 1,
      })
      .expect(200);
    expect(activeMechanics.body.meta.total).toBe(1);
    expect(activeMechanics.body.data[0].id).toBe(mechanicUserId);

    const secondUserPage = await request(server())
      .get('/users')
      .query({
        role: UserRole.PARCEL_STAFF,
        banned: false,
        search: 'Ticket 08 Pagination',
        page: 2,
        limit: 20,
      })
      .expect(200);
    expect(secondUserPage.body.meta).toMatchObject({
      page: 2,
      limit: 20,
      total: 105,
      totalPages: 6,
    });
    expect(secondUserPage.body.data).toHaveLength(20);
  });

  it('enforces endpoint roles for an API group outside department access', async () => {
    await request(server())
      .get('/spare-parts/transactions')
      .set('x-e2e-role', 'department')
      .expect(403);
  });

  it('refreshes borrow and asset summaries through the complete borrow-return API flow', async () => {
    const existingCenter = await prisma.section.findUnique({
      where: { code: 'CENTER' },
    });
    const center =
      existingCenter ??
      (await prisma.section.create({
        data: { code: 'CENTER', name: 'Ticket 08 asset center' },
      }));
    const normalStatus = await prisma.assetStatus.findUniqueOrThrow({
      where: { code: 'NORMAL' },
    });
    const availableStatus = await prisma.availabilityStatus.findUniqueOrThrow({
      where: { code: 'AVAILABLE' },
    });
    await Promise.all(
      ['RESERVED', 'BORROWED'].map((code) =>
        prisma.availabilityStatus.upsert({
          where: { code },
          create: { code, name: code },
          update: {},
        }),
      ),
    );
    const centerAsset = await prisma.asset.create({
      data: {
        name: 'Ticket 08 write-flow asset',
        model: 'Write-flow test model',
        price: new Prisma.Decimal('1.00'),
        receivedDate: new Date('2026-01-01T00:00:00.000Z'),
        type_id: assetTypeId,
        section_id: center.id,
        company_id: companyId,
        asset_status_id: normalStatus.id,
        availability_status_id: availableStatus.id,
        owner_id: userId,
        createdBy: userId,
        updatedBy: userId,
      },
    });
    extraAssetIds.push(centerAsset.id);

    const before = (
      await request(server())
        .get('/borrowings/summary')
        .query({ sectionId })
        .set('x-e2e-role', 'department')
        .expect(200)
    ).body as BorrowSummaryResponse;
    expect(before.total).toBe(107);

    const created = await request(server())
      .post('/borrowings')
      .set('x-e2e-role', 'department')
      .send({ assetId: centerAsset.id, deliveryMethod: 'PICKUP' })
      .expect(201);
    const borrowId = created.body.id as string;
    writeFlowBorrowIds.push(borrowId);

    const assertBorrowStatusCount = async (
      statusCode: string,
      expected: number,
      expectedTotal: number,
    ) => {
      const response = await request(server())
        .get('/borrowings/summary')
        .query({ sectionId })
        .set('x-e2e-role', 'department')
        .expect(200);
      const summary = response.body as BorrowSummaryResponse;
      expect(summary.total).toBe(expectedTotal);
      expect(summary.byStatusCode[statusCode]).toBe(expected);
    };

    await assertBorrowStatusCount('PENDING_APPROVE', 4, 108);
    let assetSummary = (
      await request(server())
        .get('/asset/summary')
        .query({ section_id: center.id })
        .expect(200)
    ).body as AssetSummaryResponse;
    expect(assetSummary.byAvailabilityStatusCode.RESERVED).toBe(1);

    await request(server())
      .patch(`/borrowings/${borrowId}/approve`)
      .expect(200);
    await assertBorrowStatusCount('APPROVED', 3, 108);

    await request(server())
      .patch(`/borrowings/${borrowId}/handover`)
      .expect(200);
    await assertBorrowStatusCount('BORROWED', 38, 108);
    assetSummary = (
      await request(server())
        .get('/asset/summary')
        .query({ section_id: center.id })
        .expect(200)
    ).body as AssetSummaryResponse;
    expect(assetSummary.byAvailabilityStatusCode.BORROWED).toBe(1);

    await request(server())
      .patch(`/borrowings/${borrowId}/request-return`)
      .set('x-e2e-role', 'department')
      .send({ pickupLocation: 'Ticket 08 test location' })
      .expect(200);
    await assertBorrowStatusCount('PENDING_RETURN', 5, 108);

    await request(server())
      .patch(`/borrowings/${borrowId}/claim-pickup`)
      .expect(200);
    await assertBorrowStatusCount('IN_PICKUP', 2, 108);

    await request(server())
      .patch(`/borrowings/${borrowId}/complete-return`)
      .send({ returnCondition: ReturnCondition.Normal })
      .expect(200);
    await assertBorrowStatusCount('RETURNED', 21, 108);
    assetSummary = (
      await request(server())
        .get('/asset/summary')
        .query({ section_id: center.id })
        .expect(200)
    ).body as AssetSummaryResponse;
    expect(assetSummary.byAvailabilityStatusCode.AVAILABLE).toBe(1);
  });

  it('refreshes repair and asset summaries after a committed repair request', async () => {
    await prisma.assetStatus.upsert({
      where: { code: 'UNDER_REPAIR' },
      create: { code: 'UNDER_REPAIR', name: 'Under repair' },
      update: {},
    });
    const normalStatus = await prisma.assetStatus.findUniqueOrThrow({
      where: { code: 'NORMAL' },
    });
    const availableStatus = await prisma.availabilityStatus.findUniqueOrThrow({
      where: { code: 'AVAILABLE' },
    });
    const repairAsset = await prisma.asset.create({
      data: {
        name: 'Ticket 08 repair write-flow asset',
        model: 'Repair write-flow test model',
        price: new Prisma.Decimal('1.00'),
        receivedDate: new Date('2026-01-01T00:00:00.000Z'),
        type_id: assetTypeId,
        section_id: sectionId,
        company_id: companyId,
        asset_status_id: normalStatus.id,
        availability_status_id: availableStatus.id,
        owner_id: userId,
        createdBy: userId,
        updatedBy: userId,
      },
    });
    extraAssetIds.push(repairAsset.id);

    const before = (
      await request(server())
        .get('/repairs/summary')
        .query({ sectionId })
        .expect(200)
    ).body as { total: number; byStatusCode: Record<string, number> };
    const created = await request(server())
      .post('/repairs')
      .send({
        assetId: repairAsset.id,
        symptom: 'Ticket 08 API write-flow check',
        urgencyStatus: UrgencyStatus.NORMAL,
        reportType: ReportType.Repair,
      })
      .expect(201);
    const repairId = created.body.id as string;
    repairIds.push(repairId);

    const after = (
      await request(server())
        .get('/repairs/summary')
        .query({ sectionId })
        .expect(200)
    ).body as { total: number; byStatusCode: Record<string, number> };
    expect(after.total).toBe(before.total + 1);
    expect(after.byStatusCode.PENDING_ASSIGN).toBe(
      before.byStatusCode.PENDING_ASSIGN + 1,
    );

    const assetSummary = (
      await request(server())
        .get('/asset/summary')
        .query({ section_id: sectionId })
        .expect(200)
    ).body as AssetSummaryResponse;
    expect(assetSummary.byAssetStatusCode.UNDER_REPAIR).toBe(1);
    expect(assetSummary.byAvailabilityStatusCode.UNAVAILABLE).toBe(67);

    await prisma.sparepart.update({
      where: { id: workflowSparepartId },
      data: { minStock: 4, qtyInStock: 5 },
    });
    for (const stepNumber of [2, 3, 6, 7]) {
      const existing = await prisma.stepMaster.findFirst({
        where: { actionType: StepActionType.WITH_PARTS, stepNumber },
      });
      if (!existing) {
        const step = await prisma.stepMaster.create({
          data: {
            actionType: StepActionType.WITH_PARTS,
            stepNumber,
            label: `Ticket 08 WITH_PARTS ${stepNumber}`,
          },
        });
        workflowStepMasterIds.push(step.id);
      }
    }
    const cause = await prisma.cause.create({
      data: {
        code: randomUUID().replaceAll('-', '').slice(0, 10),
        name: `Ticket 08 cause ${randomUUID().slice(0, 8)}`,
      },
    });
    const techCategory = await prisma.techCategory.create({
      data: {
        code: `T08-${randomUUID().slice(0, 10)}`,
        name: `Ticket 08 category ${randomUUID().slice(0, 8)}`,
      },
    });
    const stockSummaryBefore = (
      await request(server()).get('/spare-parts/summary').expect(200)
    ).body as {
      total: number;
      byStockStatus: { NORMAL: number; LOW: number; OUT: number };
    };
    const partBefore = await request(server())
      .get(`/spare-parts/${workflowSparepartId}`)
      .expect(200);
    expect(partBefore.body.qtyInStock).toBe(5);

    await request(server())
      .patch(`/repairs/${repairId}/diagnose`)
      .set('x-e2e-role', 'mechanic')
      .send({
        diagnosis: 'Internal spare part required',
        solution: 'Replace the test part',
        causeId: cause.id,
        techCategoryId: techCategory.id,
        jobTypeId: repairJobTypeId,
        actionType: ActionType.REPAIR,
        stepActionType: StepActionType.WITH_PARTS,
        spareParts: [
          {
            sparepartId: workflowSparepartId,
            qty: 1,
            stockType: 'INTERNAL',
          },
        ],
      })
      .expect(200);
    const diagnosedSummary = (
      await request(server())
        .get('/repairs/summary')
        .query({ sectionId })
        .expect(200)
    ).body as { total: number; byStatusCode: Record<string, number> };
    expect(diagnosedSummary.byStatusCode.PARCEL_PROCESSING).toBe(
      before.byStatusCode.PARCEL_PROCESSING + 1,
    );
    expect(
      await prisma.sparepartTxn.findFirst({
        where: { jobId: repairId, txnType: 'PENDING_WITHDRAW' },
      }),
    ).not.toBeNull();
    expect(
      (
        (await request(server()).get('/spare-parts/summary').expect(200))
          .body as typeof stockSummaryBefore
      ).byStockStatus,
    ).toEqual(stockSummaryBefore.byStockStatus);

    await request(server())
      .patch(`/repairs/${repairId}/steps/next`)
      .set('x-e2e-role', 'parcel')
      .send({})
      .expect(200);
    await request(server())
      .patch(`/repairs/${repairId}/steps/next`)
      .set('x-e2e-role', 'mechanic')
      .send({})
      .expect(200);
    const withdrawnPart = await request(server())
      .get(`/spare-parts/${workflowSparepartId}`)
      .expect(200);
    expect(withdrawnPart.body.qtyInStock).toBe(4);
    const withdrawnSummary = (
      await request(server()).get('/spare-parts/summary').expect(200)
    ).body as typeof stockSummaryBefore;
    expect(withdrawnSummary.byStockStatus).toEqual({
      NORMAL: stockSummaryBefore.byStockStatus.NORMAL - 1,
      LOW: stockSummaryBefore.byStockStatus.LOW + 1,
      OUT: stockSummaryBefore.byStockStatus.OUT,
    });

    await request(server())
      .post(`/repairs/${repairId}/spare-parts/return`)
      .set('x-e2e-role', 'parcel')
      .send({ sparepartId: workflowSparepartId, qty: 1 })
      .expect(201);
    const returnedPart = await request(server())
      .get(`/spare-parts/${workflowSparepartId}`)
      .expect(200);
    expect(returnedPart.body.qtyInStock).toBe(5);
    const returnedSummary = (
      await request(server()).get('/spare-parts/summary').expect(200)
    ).body as typeof stockSummaryBefore;
    expect(returnedSummary.byStockStatus).toEqual(
      stockSummaryBefore.byStockStatus,
    );
    const transactions = await request(server())
      .get('/spare-parts/transactions')
      .query({ jobId: repairId, limit: 20 })
      .expect(200);
    expect(transactions.body.meta.total).toBe(2);
    expect(
      transactions.body.data.map(({ txnType }: { txnType: string }) => txnType),
    ).toEqual(expect.arrayContaining(['WITHDRAW', 'RETURN']));

    await prisma.sparepartTxn.deleteMany({ where: { jobId: repairId } });
    await prisma.repairJob.delete({ where: { id: repairId } });
    await prisma.cause.delete({ where: { id: cause.id } });
    await prisma.techCategory.delete({ where: { id: techCategory.id } });
    await prisma.asset.update({
      where: { id: repairAsset.id },
      data: {
        asset_status_id: normalStatus.id,
        availability_status_id: availableStatus.id,
      },
    });
  });

  it('shows an API-edited user through the database-filtered user list', async () => {
    await request(server())
      .patch(`/users/${userId}`)
      .set('x-e2e-role', 'admin')
      .send({ firstname: 'Ticket 08 Updated User' })
      .expect(200);

    const response = await request(server())
      .get('/users')
      .query({ search: 'Ticket 08 Updated User', limit: 20 })
      .expect(200);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({
      id: userId,
      firstname: 'Ticket 08 Updated User',
    });
  });

  it('pages the unevaluated queue by the caller assignment scope before counting', async () => {
    const status = await prisma.jobStatus.findUniqueOrThrow({
      where: { code: 'IN_PROGRESS' },
    });
    const ids = Array.from({ length: 4 }, () => randomUUID());
    repairIds.push(...ids);
    await prisma.repairJob.createMany({
      data: ids.map((id, index) => ({
        id,
        jobNo: `${fixturePrefix}-T09-QUEUE-${index}`,
        assetId,
        sectionId,
        reporterId: userId,
        jobTypeId: repairJobTypeId,
        reportType: ReportType.Repair,
        urgencyStatus: UrgencyStatus.NORMAL,
        jobStatusId: status.id,
        diagnosis: index === 3 ? 'Already evaluated' : null,
        createdBy: userId,
        updatedBy: userId,
      })),
    });
    await prisma.mechanicRepair.createMany({
      data: [
        { jobId: ids[0], userId: mechanicUserId },
        { jobId: ids[2], userId: outsideUserId },
        { jobId: ids[3], userId: mechanicUserId },
      ],
    });
    const mine = await request(server())
      .get('/repairs')
      .set('x-e2e-role', 'mechanic')
      .query({
        search: `${fixturePrefix}-T09-QUEUE`,
        assignmentScope: 'MINE',
        evaluatedOnly: false,
        limit: 1,
      })
      .expect(200);
    expect(mine.body.meta.total).toBe(1);
    expect(mine.body.data[0].id).toBe(ids[0]);
    const head = await request(server())
      .get('/repairs')
      .set('x-e2e-role', 'mechanic')
      .query({
        search: `${fixturePrefix}-T09-QUEUE`,
        assignmentScope: 'MINE_OR_UNASSIGNED',
        evaluatedOnly: false,
        limit: 1,
        page: 2,
      })
      .expect(200);
    expect(head.body.meta.total).toBe(2);
    const first = await request(server())
      .get('/repairs')
      .set('x-e2e-role', 'mechanic')
      .query({
        search: `${fixturePrefix}-T09-QUEUE`,
        assignmentScope: 'MINE_OR_UNASSIGNED',
        evaluatedOnly: false,
        limit: 1,
      })
      .expect(200);
    expect(new Set([first.body.data[0].id, head.body.data[0].id])).toEqual(
      new Set([ids[0], ids[1]]),
    );
    const typed = await request(server())
      .get('/repairs')
      .query({ assetTypeId, search: `${fixturePrefix}-T09-QUEUE` })
      .expect(200);
    expect(typed.body.meta.total).toBe(4);
    await request(server())
      .get('/repairs')
      .query({ assignmentScope: 'INVALID', assetTypeId: 0 })
      .expect(400);
  });
  it('preserves model, serial, full-name and displayed request-number searches', async () => {
    const model = fixturePrefix + '-T09-MODEL';
    const serial = fixturePrefix + '-T09-SERIAL';
    await prisma.asset.update({
      where: { id: assetId },
      data: { model, serialNo: serial },
    });
    for (const search of [model, serial]) {
      const borrowResponse = await request(server())
        .get('/borrowings')
        .query({ search, limit: 20 })
        .expect(200);
      expect(borrowResponse.body.meta.total).toBeGreaterThan(100);
      expect(
        borrowResponse.body.data.every(
          (row: { asset_id: string }) => row.asset_id === assetId,
        ),
      ).toBe(true);
      const repairResponse = await request(server())
        .get('/repairs')
        .query({ search, limit: 20 })
        .expect(200);
      expect(repairResponse.body.meta.total).toBeGreaterThan(0);
      expect(
        repairResponse.body.data.every(
          (row: { assetId: string }) => row.assetId === assetId,
        ),
      ).toBe(true);
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const fullName = [user.firstname, user.lastname].join(' ');
    const names = await request(server())
      .get('/borrowings')
      .query({ search: fullName, limit: 20 })
      .expect(200);
    expect(names.body.meta.total).toBeGreaterThan(100);
    const job = await prisma.repairJob.findFirstOrThrow({
      where: { jobNo: { contains: '-T09-QUEUE-0' } },
    });
    const number = 'REP-T09-' + randomUUID();
    await prisma.repairJob.update({
      where: { id: job.id },
      data: { jobNo: number },
    });
    for (const prefix of ['REP-', 'REQ-', 'OUT-']) {
      const response = await request(server())
        .get('/repairs')
        .query({ search: number.replace('REP-', prefix), limit: 20 })
        .expect(200);
      expect(response.body.meta.total).toBe(1);
      expect(response.body.data[0].id).toBe(job.id);
    }
  });
  it('lets maintenance heads read the paged spare picker without granting stock writes', async () => {
    const list = await request(server())
      .get('/spare-parts')
      .set('x-e2e-role', 'mechanic')
      .query({ page: 1, limit: 20 })
      .expect(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    expect(list.body.data.length).toBeLessThanOrEqual(20);
    for (const [method, endpoint, body] of [
      ['post', '/spare-parts', { code: 'HEAD-NOT-ALLOWED', name: 'Blocked', price: 1, groupId: workflowSparepartGroupId }],
      ['post', '/spare-parts/stock-in', { sparepartId: workflowSparepartId, qty: 1, totalPrice: 1 }],
      ['patch', '/spare-parts/' + workflowSparepartId, { name: 'Blocked' }],
      ['delete', '/spare-parts/' + workflowSparepartId, {}],
    ] as const) {
      await request(server())[method](endpoint)
        .set('x-e2e-role', 'mechanic')
        .send(body)
        .expect(403);
    }
    await request(server())
      .get('/spare-parts')
      .set('x-e2e-role', 'department')
      .expect(403);
  });

});
