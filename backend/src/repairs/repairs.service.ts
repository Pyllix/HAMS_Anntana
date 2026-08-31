import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { paginate } from 'src/common/utils/paginate.util';
import { CreateRepairRequestDto } from './dto/create-repair-request.dto';
import { DiagnoseRepairJobDto } from './dto/diagnose-repair-job.dto';
import { UpdateRepairStepDto } from './dto/update-repair-step.dto';
import { ReturnRepairSparePartDto } from './dto/return-repair-spare-part.dto';
import { CompleteRepairJobDto } from './dto/complete-repair-job.dto';
import { QueryRepairJobDto } from './dto/query-repair-job.dto';
import {
  ActionType,
  Prisma,
  StepActionType,
  UserRole,
} from '@prisma/client';

@Injectable()
export class RepairsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ───────────────────────────────────────────────────────────────────────────

  private async getStatusId(
    model: 'jobStatus' | 'assetStatus' | 'availabilityStatus',
    code: string,
  ): Promise<number> {
    const status = await (this.prisma[model] as any).findUnique({
      where: { code },
    });
    if (!status) {
      throw new NotFoundException(`Status code '${code}' not found in ${model}`);
    }
    return status.id;
  }

  private async generateJobNo(tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || this.prisma;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `REP-${year}${month}-`;

    const latest = await client.repairJob.findFirst({
      where: { jobNo: { startsWith: prefix } },
      orderBy: { jobNo: 'desc' },
      select: { jobNo: true },
    });

    let nextSeq = 1;
    if (latest && latest.jobNo) {
      const parts = latest.jobNo.split('-');
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  private async getCallerSectionId(user: any, tx?: Prisma.TransactionClient): Promise<string | null> {
    if (user?.section_id) return user.section_id;
    if (user?.id) {
      const client = tx || this.prisma;
      const dbUser = await client.user.findUnique({
        where: { id: user.id },
        select: { section_id: true },
      });
      return dbUser?.section_id ?? null;
    }
    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Create Repair Request (แจ้งซ่อม)
  // ───────────────────────────────────────────────────────────────────────────

  async createRequest(dto: CreateRepairRequestDto, user: any) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
      include: { status: true },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ID ${dto.assetId} not found`);
    }

    const underRepairStatusId = await this.getStatusId('assetStatus', 'UNDER_REPAIR');
    const unavailableAvailabilityId = await this.getStatusId('availabilityStatus', 'UNAVAILABLE');
    const pendingJobStatusId = await this.getStatusId('jobStatus', 'PENDING');

    // Default JobType to first available if not specified
    const defaultJobType = await this.prisma.jobType.findFirst({
      orderBy: { id: 'asc' },
    });
    if (!defaultJobType) {
      throw new NotFoundException('No JobType configured in system');
    }

    const callerSectionId = await this.getCallerSectionId(user);
    const sectionId = dto.sectionId || asset.section_id || callerSectionId;
    if (!sectionId) {
      throw new BadRequestException('Section ID is required for repair request');
    }

    return this.prisma.$transaction(async (tx) => {
      const jobNo = await this.generateJobNo(tx);

      // 1. Create RepairJob
      const repairJob = await tx.repairJob.create({
        data: {
          jobNo,
          assetId: dto.assetId,
          sectionId,
          reporterId: user.id,
          jobTypeId: defaultJobType.id,
          reportType: dto.reportType,
          jobStatusId: pendingJobStatusId,
          symptom: dto.symptom,
          urgencyStatus: dto.urgencyStatus,
          createdBy: user.id,
          updatedBy: user.id,
        },
        include: {
          asset: true,
          section: true,
          reporter: {
            select: { id: true, firstname: true, lastname: true, email: true },
          },
          jobStatus: true,
        },
      });

      // 2. Update Asset status to UNDER_REPAIR & UNAVAILABLE
      await tx.asset.update({
        where: { id: dto.assetId },
        data: {
          asset_status_id: underRepairStatusId,
          availability_status_id: unavailableAvailabilityId,
          updatedBy: user.id,
        },
      });

      return repairJob;
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Diagnose and Plan (ช่างรับงาน วินิจฉัย และ Clone 12 Steps)
  // ───────────────────────────────────────────────────────────────────────────

  async diagnoseAndPlan(id: string, dto: DiagnoseRepairJobDto, user: any) {
    const job = await this.prisma.repairJob.findUnique({
      where: { id },
      include: { jobStatus: true },
    });

    if (!job) {
      throw new NotFoundException(`Repair job #${id} not found`);
    }

    if (job.jobStatus.code === 'COMPLETED' || job.jobStatus.code === 'CANCELLED') {
      throw new BadRequestException(`Cannot modify completed or cancelled repair job`);
    }

    // Validate Lookups
    const [cause, techCat, jobType] = await Promise.all([
      this.prisma.cause.findUnique({ where: { id: dto.causeId } }),
      this.prisma.techCategory.findUnique({ where: { id: dto.techCategoryId } }),
      this.prisma.jobType.findUnique({ where: { id: dto.jobTypeId } }),
    ]);

    if (!cause) throw new NotFoundException(`Cause #${dto.causeId} not found`);
    if (!techCat) throw new NotFoundException(`Tech category #${dto.techCategoryId} not found`);
    if (!jobType) throw new NotFoundException(`Job type #${dto.jobTypeId} not found`);

    if (dto.stepActionType === StepActionType.OUTSOURCE && !dto.companyId) {
      throw new BadRequestException('Company ID is required for OUTSOURCE step action type');
    }

    // Validate Spare Parts for INTERNAL_STOCK: Stock must not be deficient
    if (dto.stepActionType === StepActionType.INTERNAL_STOCK && dto.spareParts && dto.spareParts.length > 0) {
      for (const item of dto.spareParts) {
        const sp = await this.prisma.sparepart.findUnique({
          where: { id: item.sparepartId, deletedAt: null },
        });
        if (!sp) {
          throw new NotFoundException(`Spare part #${item.sparepartId} not found`);
        }
        if (sp.qtyInStock < item.qty) {
          throw new BadRequestException(
            `Insufficient stock for spare part "${sp.name}" (${sp.code}). In stock: ${sp.qtyInStock}, Requested: ${item.qty}. Please select EXTERNAL_STOCK or adjust quantity.`,
          );
        }
      }
    }

    const inProgressStatusId = await this.getStatusId('jobStatus', 'IN_PROGRESS');

    // Fetch master steps template using stepActionType
    const stepMasters = await this.prisma.stepMaster.findMany({
      where: { actionType: dto.stepActionType },
      orderBy: { stepNumber: 'asc' },
    });

    if (stepMasters.length === 0) {
      throw new NotFoundException(`No step templates found for step action type ${dto.stepActionType}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update RepairJob
      const updatedJob = await tx.repairJob.update({
        where: { id },
        data: {
          diagnosis: dto.diagnosis,
          solution: dto.solution,
          causeId: dto.causeId,
          techCategoryId: dto.techCategoryId,
          jobTypeId: dto.jobTypeId,
          actionType: dto.actionType,
          jobStatusId: inProgressStatusId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          isRepeatRepair: dto.isRepeatRepair ?? false,
          companyId: dto.companyId ?? null,
          billNo: dto.billNo ?? null,
          updatedBy: user.id,
        },
      });

      // 2. Assign Mechanics
      const mechanicIds = dto.mechanicIds && dto.mechanicIds.length > 0 ? dto.mechanicIds : [user.id];
      await tx.mechanicRepair.deleteMany({ where: { jobId: id } });
      for (const mechId of mechanicIds) {
        await tx.mechanicRepair.create({
          data: {
            jobId: id,
            userId: mechId,
          },
        });
      }

      // 3. Clone 12 Steps from StepMaster (Delete old steps if re-diagnosing)
      await tx.repairJobStep.deleteMany({ where: { jobId: id } });
      const now = new Date();
      for (const sm of stepMasters) {
        // Steps 1 to 4 are completed up to diagnosis
        let completeAt: Date | null = null;
        let completedBy: string | null = null;
        if (sm.stepNumber <= 4) {
          completeAt = now;
          completedBy = user.id;
        }

        await tx.repairJobStep.create({
          data: {
            jobId: id,
            stepMasterId: sm.id,
            completeAt,
            completedBy,
          },
        });
      }

      return this.findOne(id, tx);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Update Step Progress (Step 1 - 12)
  // ───────────────────────────────────────────────────────────────────────────

  async updateStepProgress(
    jobId: string,
    stepNumber: number,
    dto: UpdateRepairStepDto,
    user: any,
  ) {
    const job = await this.prisma.repairJob.findUnique({
      where: { id: jobId },
      include: {
        repairJobSteps: {
          include: { stepMaster: true },
          orderBy: { stepMaster: { stepNumber: 'asc' } },
        },
        jobStatus: true,
      },
    });

    if (!job) {
      throw new NotFoundException(`Repair job #${jobId} not found`);
    }

    const currentStepActionType = job.repairJobSteps[0]?.stepMaster?.actionType;
    if (!currentStepActionType) {
      throw new BadRequestException('Repair job must be diagnosed before updating steps');
    }

    const targetStep = job.repairJobSteps.find(
      (s) => s.stepMaster.stepNumber === stepNumber,
    );

    if (!targetStep) {
      throw new NotFoundException(`Step #${stepNumber} not found for this job`);
    }

    const completionTime = dto.completeAt ? new Date(dto.completeAt) : new Date();

    return this.prisma.$transaction(async (tx) => {
      // Step-specific Business Rules
      if (currentStepActionType === StepActionType.INTERNAL_STOCK) {
        // Step 7: อนุมัติจัดหาอะไหล่ในคลัง ➔ กัน/ตัดสต็อกทันที
        // (If spare parts were specified during diagnose or stored in sparepartTxns)
      }

      // Step 9: ช่างรับพัสดุ/อะไหล่ ➔ บันทึก SPAREPART_TXN (WITHDRAW) ถ้ายังไม่บันทึก
      // Step 11: แจ้งเตือนแล้วเสร็จ / รอตรวจรับ
      if (stepNumber === 11) {
        const waitingDeliveryStatusId = await this.getStatusId('jobStatus', 'WAITING_DELIVERY');
        await tx.repairJob.update({
          where: { id: jobId },
          data: { jobStatusId: waitingDeliveryStatusId, updatedBy: user.id },
        });
      }

      // Update Step Record
      const updatedStep = await tx.repairJobStep.update({
        where: { id: targetStep.id },
        data: {
          completeAt: completionTime,
          completedBy: user.id,
          note: dto.note ?? targetStep.note,
        },
        include: { stepMaster: true, user: true },
      });

      return {
        step: updatedStep,
        job: await this.findOne(jobId, tx),
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Spare Parts Requisition & Return within Repair Job
  // ───────────────────────────────────────────────────────────────────────────

  async withdrawSparePart(
    jobId: string,
    sparepartId: number,
    qty: number,
    user: any,
  ) {
    const job = await this.prisma.repairJob.findUnique({
      where: { id: jobId },
      include: { repairJobSteps: { include: { stepMaster: true } } },
    });
    if (!job) throw new NotFoundException(`Repair job #${jobId} not found`);

    const sp = await this.prisma.sparepart.findUnique({
      where: { id: sparepartId, deletedAt: null },
    });
    if (!sp) throw new NotFoundException(`Spare part #${sparepartId} not found`);

    const currentStepActionType = job.repairJobSteps[0]?.stepMaster?.actionType;
    if (currentStepActionType === StepActionType.INTERNAL_STOCK && sp.qtyInStock < qty) {
      throw new BadRequestException(
        `Insufficient stock for "${sp.name}". In stock: ${sp.qtyInStock}, Requested: ${qty}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Deduct stock
      await tx.sparepart.update({
        where: { id: sparepartId },
        data: { qtyInStock: { decrement: qty } },
      });

      // 2. Create SPAREPART_TXN (WITHDRAW)
      const txn = await tx.sparepartTxn.create({
        data: {
          sparepartId,
          jobId,
          txnType: 'WITHDRAW',
          qty,
          unitPrice: sp.price,
          txnBy: user.id,
        },
        include: { sparepart: true, user: true },
      });

      return txn;
    });
  }

  async returnSparePart(
    jobId: string,
    dto: ReturnRepairSparePartDto,
    user: any,
  ) {
    const job = await this.prisma.repairJob.findUnique({
      where: { id: jobId },
      include: { jobStatus: true },
    });
    if (!job) throw new NotFoundException(`Repair job #${jobId} not found`);

    if (job.jobStatus.code === 'COMPLETED') {
      throw new BadRequestException('Cannot return spare parts for completed repair jobs');
    }

    const sp = await this.prisma.sparepart.findUnique({
      where: { id: dto.sparepartId, deletedAt: null },
    });
    if (!sp) throw new NotFoundException(`Spare part #${dto.sparepartId} not found`);

    // Verify total withdrawn qty for this job
    const withdrawnTxns = await this.prisma.sparepartTxn.findMany({
      where: { jobId, sparepartId: dto.sparepartId, txnType: 'WITHDRAW' },
    });
    const returnedTxns = await this.prisma.sparepartTxn.findMany({
      where: { jobId, sparepartId: dto.sparepartId, txnType: 'RETURN' },
    });

    const totalWithdrawn = withdrawnTxns.reduce((acc, t) => acc + t.qty, 0);
    const totalReturned = returnedTxns.reduce((acc, t) => acc + t.qty, 0);
    const availableToReturn = totalWithdrawn - totalReturned;

    if (dto.qty > availableToReturn) {
      throw new BadRequestException(
        `Cannot return ${dto.qty} items. Maximum returnable quantity for this job is ${availableToReturn}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Increment inventory stock
      await tx.sparepart.update({
        where: { id: dto.sparepartId },
        data: { qtyInStock: { increment: dto.qty } },
      });

      // 2. Record SPAREPART_TXN (RETURN)
      const txn = await tx.sparepartTxn.create({
        data: {
          sparepartId: dto.sparepartId,
          jobId,
          txnType: 'RETURN',
          qty: dto.qty,
          unitPrice: sp.price,
          txnBy: user.id,
        },
        include: { sparepart: true, user: true },
      });

      return txn;
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Complete, Handover & Close Job (Step 12 / ปิดงาน)
  // ───────────────────────────────────────────────────────────────────────────

  async completeAndCloseJob(id: string, dto: CompleteRepairJobDto, user: any) {
    const job = await this.prisma.repairJob.findUnique({
      where: { id },
      include: {
        jobStatus: true,
        repairJobSteps: { include: { stepMaster: true } },
      },
    });

    if (!job) {
      throw new NotFoundException(`Repair job #${id} not found`);
    }

    if (job.jobStatus.code === 'COMPLETED') {
      throw new BadRequestException('Repair job is already completed');
    }

    const completedJobStatusId = await this.getStatusId('jobStatus', 'COMPLETED');
    const normalAssetStatusId = await this.getStatusId('assetStatus', 'NORMAL');
    const waitDisposalStatusId = await this.getStatusId('assetStatus', 'WAIT_DISPOSAL');
    const availableAvailabilityId = await this.getStatusId('availabilityStatus', 'AVAILABLE');
    const unavailableAvailabilityId = await this.getStatusId('availabilityStatus', 'UNAVAILABLE');

    const returnDate = dto.returnDate ? new Date(dto.returnDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Update RepairJob status to COMPLETED
      const updatedJob = await tx.repairJob.update({
        where: { id },
        data: {
          jobStatusId: completedJobStatusId,
          warrantyDate: dto.warrantyDate,
          receiverId: dto.receiverId,
          returnDate,
          updatedBy: user.id,
        },
      });

      // 2. Complete Step 10, 11, 12 if not completed yet
      const step10 = job.repairJobSteps.find((s) => s.stepMaster.stepNumber === 10);
      const step11 = job.repairJobSteps.find((s) => s.stepMaster.stepNumber === 11);
      const step12 = job.repairJobSteps.find((s) => s.stepMaster.stepNumber === 12);

      if (step10 && !step10.completeAt) {
        await tx.repairJobStep.update({
          where: { id: step10.id },
          data: { completeAt: returnDate, completedBy: user.id },
        });
      }
      if (step11 && !step11.completeAt) {
        await tx.repairJobStep.update({
          where: { id: step11.id },
          data: { completeAt: returnDate, completedBy: user.id },
        });
      }
      if (step12 && !step12.completeAt) {
        await tx.repairJobStep.update({
          where: { id: step12.id },
          data: { completeAt: returnDate, completedBy: user.id },
        });
      }

      // 3. Update Asset Status:
      // If PURCHASE_REPLACEMENT -> WAIT_DISPOSAL, UNAVAILABLE
      // Otherwise -> NORMAL, AVAILABLE
      const currentStepActionType = job.repairJobSteps[0]?.stepMaster?.actionType;
      if (currentStepActionType === StepActionType.PURCHASE_REPLACEMENT) {
        await tx.asset.update({
          where: { id: job.assetId },
          data: {
            asset_status_id: waitDisposalStatusId,
            availability_status_id: unavailableAvailabilityId,
            updatedBy: user.id,
          },
        });
      } else {
        await tx.asset.update({
          where: { id: job.assetId },
          data: {
            asset_status_id: normalAssetStatusId,
            availability_status_id: availableAvailabilityId,
            updatedBy: user.id,
          },
        });
      }

      return this.findOne(id, tx);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Find All & Query
  // ───────────────────────────────────────────────────────────────────────────

  async findAll(query: QueryRepairJobDto, user: any) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const search = query.search?.trim();

    const where: Prisma.RepairJobWhereInput = {};

    // RBAC Scoping: DEPARTMENT_STAFF can only view jobs for their own section
    if (user.role === UserRole.DEPARTMENT_STAFF) {
      const userSectionId = await this.getCallerSectionId(user);
      if (userSectionId) {
        where.sectionId = userSectionId;
      }
    } else if (query.sectionId) {
      where.sectionId = query.sectionId;
    }

    if (query.statusCode) {
      where.jobStatus = { code: query.statusCode };
    }
    if (query.actionType) {
      where.actionType = query.actionType;
    }
    if (query.stepActionType) {
      where.repairJobSteps = {
        some: {
          stepMaster: { actionType: query.stepActionType },
        },
      };
    }
    if (query.urgencyStatus) {
      where.urgencyStatus = query.urgencyStatus;
    }
    if (query.reportType) {
      where.reportType = query.reportType;
    }
    if (query.assetId) {
      where.assetId = query.assetId;
    }
    if (query.reporterId) {
      where.reporterId = query.reporterId;
    }
    if (query.mechanicId) {
      where.mechanicRepairs = { some: { userId: query.mechanicId } };
    }

    if (search) {
      where.OR = [
        { jobNo: { contains: search, mode: 'insensitive' } },
        { symptom: { contains: search, mode: 'insensitive' } },
        { diagnosis: { contains: search, mode: 'insensitive' } },
        { asset: { name: { contains: search, mode: 'insensitive' } } },
        { asset: { noid: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.repairJob.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          asset: {
            select: {
              id: true,
              noid: true,
              name: true,
              model: true,
              serialNo: true,
              imageUrl: true,
            },
          },
          section: { select: { id: true, code: true, name: true } },
          reporter: { select: { id: true, firstname: true, lastname: true, email: true } },
          jobStatus: true,
          jobType: true,
          cause: true,
          techCategory: true,
          company: true,
          mechanicRepairs: {
            include: {
              user: {
                select: { id: true, firstname: true, lastname: true, email: true },
              },
            },
          },
        },
      }),
      this.prisma.repairJob.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findOne(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    const job = await client.repairJob.findUnique({
      where: { id },
      include: {
        asset: {
          include: {
            status: true,
            availabilityStatus: true,
            type: true,
          },
        },
        section: true,
        reporter: {
          select: { id: true, firstname: true, lastname: true, email: true, employeeId: true },
        },
        jobStatus: true,
        jobType: true,
        cause: true,
        techCategory: true,
        company: true,
        receiver: {
          select: { id: true, firstname: true, lastname: true, email: true },
        },
        creator: {
          select: { id: true, firstname: true, lastname: true, email: true },
        },
        updater: {
          select: { id: true, firstname: true, lastname: true, email: true },
        },
        mechanicRepairs: {
          include: {
            user: {
              select: { id: true, firstname: true, lastname: true, email: true },
            },
          },
        },
        repairJobSteps: {
          include: {
            stepMaster: true,
            user: {
              select: { id: true, firstname: true, lastname: true, email: true },
            },
          },
          orderBy: { stepMaster: { stepNumber: 'asc' } },
        },
        sparepartTxns: {
          include: {
            sparepart: true,
            user: {
              select: { id: true, firstname: true, lastname: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Repair job #${id} not found`);
    }

    // Calculate total spare parts cost (Withdraw - Return)
    const sparePartsCost = job.sparepartTxns.reduce((acc, t) => {
      const lineCost = Number(t.unitPrice) * t.qty;
      return t.txnType === 'WITHDRAW' ? acc + lineCost : acc - lineCost;
    }, 0);

    return {
      ...job,
      summary: {
        totalSparePartsCost: Math.max(0, sparePartsCost),
        totalSteps: job.repairJobSteps.length,
        completedSteps: job.repairJobSteps.filter((s) => s.completeAt !== null).length,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Master & Metadata Lookups
  // ───────────────────────────────────────────────────────────────────────────

  async getLookups() {
    const [jobStatuses, jobTypes, causes, techCategories, stepMasters] = await Promise.all([
      this.prisma.jobStatus.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' } }),
      this.prisma.jobType.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' } }),
      this.prisma.cause.findMany({ where: { deleteAt: null }, orderBy: { code: 'asc' } }),
      this.prisma.techCategory.findMany({ where: { deleteAt: null, isActive: true }, orderBy: { code: 'asc' } }),
      this.prisma.stepMaster.findMany({ orderBy: [{ actionType: 'asc' }, { stepNumber: 'asc' }] }),
    ]);

    return {
      jobStatuses,
      jobTypes,
      causes,
      techCategories,
      stepMasters,
    };
  }
}
