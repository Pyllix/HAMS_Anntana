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
import { RejectRepairStepDto } from './dto/reject-repair-step.dto';
import { CancelRepairJobDto } from './dto/cancel-repair-job.dto';
import { ReturnRepairSparePartDto } from './dto/return-repair-spare-part.dto';
import { QueryRepairJobDto } from './dto/query-repair-job.dto';
import { AssignRepairJobDto } from './dto/assign-repair-job.dto';
import { CompleteUnrepairableDto } from './dto/complete-unrepairable.dto';
import { UpdateRepairRequestDto } from './dto/update-repair-request.dto';
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
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  private async getCallerSectionId(user: any): Promise<string | null> {
    if (user.section_id) {
      return user.section_id;
    }
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { section_id: true },
    });
    return dbUser?.section_id || null;
  }

  private isValidCalendarDate(dateStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (month < 1 || month > 12) return false;

    const daysInMonth = new Date(year, month, 0).getDate();
    return day >= 1 && day <= daysInMonth;
  }

  private calculateOverdueInfo(job: {
    dueDate: Date | null;
    jobStatus?: { code: string } | null;
  }) {
    if (!job.dueDate) {
      return { isOverdue: false, overdueDays: 0 };
    }

    const statusCode = job.jobStatus?.code;
    if (statusCode === 'COMPLETED' || statusCode === 'CANCELLED') {
      return { isOverdue: false, overdueDays: 0 };
    }

    const now = new Date();
    const diffMs = now.getTime() - new Date(job.dueDate).getTime();
    if (diffMs > 0) {
      const overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return { isOverdue: true, overdueDays: Math.max(1, overdueDays) };
    }

    return { isOverdue: false, overdueDays: 0 };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Online Request (แจ้งซ่อม) - UC3
  // ───────────────────────────────────────────────────────────────────────────

  async createRequest(dto: CreateRepairRequestDto, user: any) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
      include: { status: true, availabilityStatus: true },
    });

    if (!asset) {
      throw new NotFoundException(`Asset #${dto.assetId} not found`);
    }

    // Asset status validation
    const blockedStatuses = ['DISPOSAL', 'LOST'];
    if (blockedStatuses.includes(asset.status.code)) {
      throw new BadRequestException(
        `Cannot request repair for an asset with status '${asset.status.name}' (${asset.status.code})`,
      );
    }

    // Check for active (in-progress) repair tickets on the same asset
    const activeJob = await this.prisma.repairJob.findFirst({
      where: {
        assetId: dto.assetId,
        jobStatus: {
          code: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
      },
    });

    if (activeJob) {
      throw new ConflictException(
        `Asset already has an active repair ticket (${activeJob.jobNo}) in progress`,
      );
    }

    const underRepairStatusId = await this.getStatusId('assetStatus', 'UNDER_REPAIR');
    const unavailableAvailabilityId = await this.getStatusId('availabilityStatus', 'UNAVAILABLE');
    const pendingAssignStatusId = await this.getStatusId('jobStatus', 'PENDING_ASSIGN');

    const defaultJobType = await this.prisma.jobType.findFirst({
      orderBy: { id: 'asc' },
    });
    if (!defaultJobType) {
      throw new NotFoundException('No JobType configured in system');
    }

    const callerSectionId = await this.getCallerSectionId(user);
    const sectionId = asset.section_id || callerSectionId;
    if (!sectionId) {
      throw new BadRequestException('Asset has no associated section and caller user has no section');
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
          jobStatusId: pendingAssignStatusId,
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
  // 2. Workload Balancing & Assignment (หัวหน้าช่าง Triage & Dispatch)
  // ───────────────────────────────────────────────────────────────────────────

  async getMechanicWorkloads() {
    const mechanics = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.MAINTENANCE_STAFF, UserRole.MAINTENANCE_HEAD] },
        deletedAt: null,
      },
      select: {
        id: true,
        employeeId: true,
        firstname: true,
        lastname: true,
        email: true,
        role: true,
        imageUrl: true,
        section_id: true,
        section: { select: { id: true, name: true } },
      },
      orderBy: { firstname: 'asc' },
    });

    return Promise.all(
      mechanics.map(async (mech) => {
        const activeJobsCount = await this.prisma.mechanicRepair.count({
          where: {
            userId: mech.id,
            job: {
              jobStatus: {
                code: { notIn: ['COMPLETED', 'CANCELLED'] },
              },
            },
          },
        });

        return {
          ...mech,
          activeJobsCount,
        };
      }),
    );
  }

  async assignJob(jobId: string, dto: AssignRepairJobDto, user: any) {
    if (user.role !== UserRole.MAINTENANCE_HEAD) {
      throw new ForbiddenException('Only MAINTENANCE_HEAD can triage and assign repair jobs');
    }

    const job = await this.prisma.repairJob.findUnique({
      where: { id: jobId },
      include: { jobStatus: true, repairJobSteps: { include: { stepMaster: true } } },
    });

    if (!job) {
      throw new NotFoundException(`Repair job #${jobId} not found`);
    }

    if (job.jobStatus.code === 'COMPLETED' || job.jobStatus.code === 'CANCELLED') {
      throw new BadRequestException(`Cannot assign a repair job that is ${job.jobStatus.code}`);
    }

    const techCategory = await this.prisma.techCategory.findUnique({
      where: { id: dto.techCategoryId, deleteAt: null },
    });
    if (!techCategory) {
      throw new NotFoundException(`Tech Category #${dto.techCategoryId} not found`);
    }

    if (!dto.mechanicIds || dto.mechanicIds.length === 0) {
      throw new BadRequestException('At least one mechanic must be assigned');
    }

    for (const mechId of dto.mechanicIds) {
      const mech = await this.prisma.user.findUnique({
        where: { id: mechId, deletedAt: null },
      });
      if (!mech) {
        throw new NotFoundException(`Mechanic user #${mechId} not found`);
      }
      if (mech.role !== UserRole.MAINTENANCE_STAFF && mech.role !== UserRole.MAINTENANCE_HEAD) {
        throw new BadRequestException(
          `User "${mech.firstname} ${mech.lastname}" (${mech.role}) is not a maintenance technician or head`,
        );
      }
    }

    const inProgressStatusId = await this.getStatusId('jobStatus', 'IN_PROGRESS');

    return this.prisma.$transaction(async (tx) => {
      const updatedJob = await tx.repairJob.update({
        where: { id: jobId },
        data: {
          techCategoryId: dto.techCategoryId,
          jobStatusId: inProgressStatusId,
          updatedBy: user.id,
        },
      });

      await tx.mechanicRepair.deleteMany({ where: { jobId } });
      for (const mechId of dto.mechanicIds) {
        await tx.mechanicRepair.create({
          data: {
            jobId,
            userId: mechId,
          },
        });
      }

      const step2 = job.repairJobSteps?.find((s) => s.stepMaster.stepNumber === 2);
      if (step2 && !step2.completeAt) {
        await tx.repairJobStep.update({
          where: { id: step2.id },
          data: {
            completeAt: new Date(),
            completedBy: user.id,
          },
        });
      }

      return updatedJob;
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Ticket Modification (แก้ไขข้อมูลใบแจ้งซ่อม)
  // ───────────────────────────────────────────────────────────────────────────

  async updateRepairRequest(jobId: string, dto: UpdateRepairRequestDto, user: any) {
    const job = await this.prisma.repairJob.findUnique({
      where: { id: jobId },
      include: { jobStatus: true },
    });

    if (!job) {
      throw new NotFoundException(`Repair job #${jobId} not found`);
    }

    if (job.jobStatus.code !== 'PENDING_ASSIGN' && job.jobStatus.code !== 'WAITING_HANDOVER') {
      throw new BadRequestException(
        `Cannot edit repair request details once it has progressed beyond PENDING_ASSIGN (Current status: ${job.jobStatus.code})`,
      );
    }

    const isReporter = job.reporterId === user.id;
    const isAuthorizedRole = user.role === UserRole.MAINTENANCE_HEAD || user.role === UserRole.ADMIN;

    if (!isReporter && !isAuthorizedRole) {
      throw new ForbiddenException('You do not have permission to edit this repair request');
    }

    if (dto.jobTypeId) {
      const jt = await this.prisma.jobType.findUnique({
        where: { id: dto.jobTypeId, deletedAt: null },
      });
      if (!jt) throw new NotFoundException(`Job Type #${dto.jobTypeId} not found`);
    }

    return this.prisma.repairJob.update({
      where: { id: jobId },
      data: {
        symptom: dto.symptom ?? job.symptom,
        urgencyStatus: dto.urgencyStatus ?? job.urgencyStatus,
        reportType: dto.reportType ?? job.reportType,
        jobTypeId: dto.jobTypeId ?? job.jobTypeId,
        updatedBy: user.id,
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Diagnose and Plan (ช่างรับงาน วินิจฉัย และ Clone Steps - 4 Tracks)
  // ───────────────────────────────────────────────────────────────────────────

  async diagnoseAndPlan(id: string, dto: DiagnoseRepairJobDto, user: any) {
    if (user.role !== UserRole.MAINTENANCE_STAFF && user.role !== UserRole.MAINTENANCE_HEAD) {
      throw new ForbiddenException('Only maintenance staff or head can diagnose repair jobs');
    }

    const job = await this.prisma.repairJob.findUnique({
      where: { id },
      include: {
        jobStatus: true,
        repairJobSteps: {
          include: { stepMaster: true },
          orderBy: { stepMaster: { stepNumber: 'asc' } },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Repair job #${id} not found`);
    }

    if (job.jobStatus.code === 'COMPLETED' || job.jobStatus.code === 'CANCELLED') {
      throw new BadRequestException(`Cannot modify completed or cancelled repair job`);
    }

    if (job.repairJobSteps && job.repairJobSteps.length > 0) {
      const hasProgressedBeyondDiagnosis = job.repairJobSteps.some(
        (s) =>
          ((s.stepMaster?.stepNumber >= 5) ||
            (s.stepMaster?.actionType === StepActionType.SELF_REPAIR && s.stepMaster?.stepNumber >= 4)) &&
          s.completeAt !== null,
      );
      if (hasProgressedBeyondDiagnosis) {
        throw new BadRequestException(
          'Cannot re-diagnose or modify diagnosis plan after post-diagnosis steps have already been completed or approved',
        );
      }
    }

    const effectiveTechCategoryId = dto.techCategoryId ?? job.techCategoryId;
    if (!effectiveTechCategoryId) {
      throw new BadRequestException('techCategoryId is required for diagnosis');
    }

    const [cause, techCat, jobType] = await Promise.all([
      this.prisma.cause.findUnique({ where: { id: dto.causeId } }),
      this.prisma.techCategory.findUnique({ where: { id: effectiveTechCategoryId } }),
      this.prisma.jobType.findUnique({ where: { id: dto.jobTypeId } }),
    ]);

    if (!cause) throw new NotFoundException(`Cause #${dto.causeId} not found`);
    if (!techCat) throw new NotFoundException(`Tech category #${effectiveTechCategoryId} not found`);
    if (!jobType) throw new NotFoundException(`Job type #${dto.jobTypeId} not found`);

    if (dto.dueDate && !this.isValidCalendarDate(dto.dueDate)) {
      throw new BadRequestException(
        `Invalid dueDate format or calendar date value: "${dto.dueDate}". Expected a valid date in YYYY-MM-DD format.`,
      );
    }

    // Validation per StepActionType (4 Tracks)
    if (dto.stepActionType === StepActionType.SELF_REPAIR) {
      if (dto.spareParts && dto.spareParts.length > 0) {
        throw new BadRequestException('Spare parts requisition is not allowed for SELF_REPAIR action type');
      }
      if (dto.unrepairableReason) {
        throw new BadRequestException('unrepairableReason cannot be specified for SELF_REPAIR');
      }
    } else if (dto.stepActionType === StepActionType.WITH_PARTS) {
      if (!dto.spareParts || dto.spareParts.length === 0) {
        throw new BadRequestException('At least one spare part must be selected for WITH_PARTS action type');
      }
      if (dto.unrepairableReason) {
        throw new BadRequestException('unrepairableReason cannot be specified for WITH_PARTS');
      }

      const spIds = dto.spareParts.map((item) => item.sparepartId);
      if (new Set(spIds).size !== spIds.length) {
        throw new BadRequestException('Duplicate spare parts found in requisition list');
      }
    } else if (dto.stepActionType === StepActionType.OUTSOURCE) {
      if (dto.spareParts && dto.spareParts.length > 0) {
        throw new BadRequestException('Spare parts requisition is not allowed for OUTSOURCE action type');
      }
      if (dto.unrepairableReason) {
        throw new BadRequestException('unrepairableReason cannot be specified for OUTSOURCE');
      }
    } else if (dto.stepActionType === StepActionType.UNREPAIRABLE) {
      if (dto.spareParts && dto.spareParts.length > 0) {
        throw new BadRequestException('Spare parts requisition is not allowed for UNREPAIRABLE action type');
      }
      if (!dto.unrepairableReason) {
        throw new BadRequestException('unrepairableReason is required for UNREPAIRABLE action type');
      }
    }

    // Validate spare parts for WITH_PARTS
    const sparePartMap: Record<number, any> = {};
    if (dto.stepActionType === StepActionType.WITH_PARTS && dto.spareParts && dto.spareParts.length > 0) {
      for (const item of dto.spareParts) {
        const sp = await this.prisma.sparepart.findUnique({
          where: { id: item.sparepartId, deletedAt: null },
        });
        if (!sp) {
          throw new NotFoundException(`Spare part #${item.sparepartId} not found`);
        }

        if (item.stockType === 'INTERNAL' && sp.qtyInStock < item.qty) {
          throw new BadRequestException(
            `Insufficient stock for spare part "${sp.name}" (${sp.code}). In stock: ${sp.qtyInStock}, Requested: ${item.qty}. Please adjust quantity or select EXTERNAL stockType.`,
          );
        }
        sparePartMap[item.sparepartId] = sp;
      }
    }

    // Determine target initial status
    let targetStatusCode = 'IN_PROGRESS';
    if (dto.stepActionType === StepActionType.WITH_PARTS) {
      const hasExternal = dto.spareParts?.some((item) => item.stockType === 'EXTERNAL');
      targetStatusCode = hasExternal ? 'WAITING_PARTS' : 'PARCEL_PROCESSING';
    } else if (dto.stepActionType === StepActionType.OUTSOURCE) {
      targetStatusCode = 'PARCEL_PROCESSING';
    } else if (dto.stepActionType === StepActionType.UNREPAIRABLE) {
      targetStatusCode = 'UNREPAIRABLE';
    } else if (dto.stepActionType === StepActionType.SELF_REPAIR) {
      targetStatusCode = 'IN_PROGRESS';
    }
    const initialJobStatusId = await this.getStatusId('jobStatus', targetStatusCode);

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
          techCategoryId: effectiveTechCategoryId,
          jobTypeId: dto.jobTypeId,
          actionType: dto.actionType,
          jobStatusId: initialJobStatusId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          isRepeatRepair: dto.isRepeatRepair ?? false,
          companyId: null,
          billNo: null,
          repairCost: null,
          unrepairableReason: dto.unrepairableReason ?? null,
          updatedBy: user.id,
        },
      });

      // 2. Ensure mechanic assignment is preserved from assignJob, or attach diagnosing user if unassigned
      const assignedCount = await tx.mechanicRepair.count({ where: { jobId: id } });
      if (assignedCount === 0) {
        await tx.mechanicRepair.create({
          data: {
            jobId: id,
            userId: user.id,
          },
        });
      }

      // 3. Clear old transactions and insert PENDING_WITHDRAW with stockType
      const existingTxns = await tx.sparepartTxn.findMany({
        where: { jobId: id },
      });
      if (existingTxns.length > 0) {
        for (const oldTxn of existingTxns) {
          if (oldTxn.txnType === 'WITHDRAW') {
            await tx.sparepart.update({
              where: { id: oldTxn.sparepartId },
              data: { qtyInStock: { increment: oldTxn.qty } },
            });
          }
        }
        await tx.sparepartTxn.deleteMany({ where: { jobId: id } });
      }

      if (dto.stepActionType === StepActionType.WITH_PARTS && dto.spareParts) {
        for (const item of dto.spareParts) {
          const sp = sparePartMap[item.sparepartId];
          await tx.sparepartTxn.create({
            data: {
              sparepartId: item.sparepartId,
              jobId: id,
              txnType: 'PENDING_WITHDRAW',
              stockType: item.stockType,
              qty: item.qty,
              unitPrice: sp.price,
              txnBy: user.id,
            },
          });
        }
      }

      // 4. Clone Steps from StepMaster (Auto-complete initial steps 1-4, or 1-3 for SELF_REPAIR)
      await tx.repairJobStep.deleteMany({ where: { jobId: id } });
      const now = new Date();
      const autoCompletedThreshold = dto.stepActionType === StepActionType.SELF_REPAIR ? 3 : 4;

      for (const sm of stepMasters) {
        let completeAt: Date | null = null;
        let completedBy: string | null = null;
        if (sm.stepNumber <= autoCompletedThreshold) {
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
  // 5. Update Step Progress & Batch Handover
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
        asset: true,
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

    if (job.jobStatus.code === 'PENDING_ASSIGN') {
      throw new BadRequestException(
        'This repair job has been rejected and is awaiting re-diagnosis by the technician before steps can be updated',
      );
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

    if (targetStep.completeAt) {
      throw new BadRequestException(
        `Step #${stepNumber} ("${targetStep.stepMaster.label}") has already been completed`,
      );
    }

    const previousIncompleteStep = job.repairJobSteps.find(
      (s) => s.stepMaster.stepNumber < stepNumber && !s.completeAt,
    );
    if (previousIncompleteStep) {
      throw new BadRequestException(
        `Cannot skip to Step #${stepNumber}. Please complete Step #${previousIncompleteStep.stepMaster.stepNumber} ("${previousIncompleteStep.stepMaster.label}") first.`,
      );
    }

    this.validateStepRole(currentStepActionType, stepNumber, user.role);

    const totalSteps = job.repairJobSteps.length;
    const isPenultimateStep = stepNumber === totalSteps - 1;
    const isFinalStep = stepNumber === totalSteps;

    if (isFinalStep && currentStepActionType !== StepActionType.UNREPAIRABLE) {
      if (!dto.receiverId) {
        throw new BadRequestException(
          'receiverId is required for the final step (ตรวจรับงานและสรุป Job)',
        );
      }
      if (!dto.warrantyDate) {
        throw new BadRequestException(
          'warrantyDate is required for the final step (ตรวจรับงานและสรุป Job)',
        );
      }
      if (!this.isValidCalendarDate(dto.warrantyDate)) {
        throw new BadRequestException(
          `Invalid warrantyDate format or calendar date value: "${dto.warrantyDate}". Expected a valid date in YYYY-MM-DD format.`,
        );
      }
      const receiver = await this.prisma.user.findUnique({
        where: { id: dto.receiverId, deletedAt: null },
      });
      if (!receiver) {
        throw new NotFoundException(`Receiver user #${dto.receiverId} not found`);
      }

      const isSameReporter = receiver.id === job.reporterId;
      const isSameSection = Boolean(
        receiver.section_id &&
          (receiver.section_id === job.sectionId ||
            (job.asset && receiver.section_id === job.asset.section_id)),
      );

      if (!isSameReporter && !isSameSection) {
        throw new BadRequestException(
          `Receiver "${receiver.firstname} ${receiver.lastname}" must either be the original repair requester or belong to the same department/section`,
        );
      }
    } else if (!isFinalStep) {
      if (dto.receiverId) {
        throw new BadRequestException(
          'receiverId cannot be provided before the final step',
        );
      }
      if (dto.warrantyDate) {
        throw new BadRequestException(
          'warrantyDate cannot be provided before the final step',
        );
      }
    }

    if (dto.companyId && !(currentStepActionType === StepActionType.OUTSOURCE && stepNumber === 5)) {
      throw new BadRequestException('companyId can only be specified on Step 5 of OUTSOURCE track');
    }

    if (
      (dto.billNo || dto.repairCost !== undefined) &&
      !(currentStepActionType === StepActionType.OUTSOURCE && stepNumber === 6)
    ) {
      throw new BadRequestException(
        'billNo and repairCost can only be specified on Step 6 of OUTSOURCE track',
      );
    }

    if (currentStepActionType === StepActionType.OUTSOURCE && stepNumber === 5 && dto.companyId) {
      const comp = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
      if (!comp) {
        throw new NotFoundException(`Company #${dto.companyId} not found`);
      }
    }

    const completionTime = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Step-specific Dynamic JobStatus Transitions
      if (currentStepActionType === StepActionType.OUTSOURCE) {
        if (stepNumber === 5) {
          const outsourcedStatusId = await this.getStatusId('jobStatus', 'OUTSOURCED');
          await tx.repairJob.update({
            where: { id: jobId },
            data: {
              jobStatusId: outsourcedStatusId,
              companyId: dto.companyId ?? job.companyId,
              updatedBy: user.id,
            },
          });
        } else if (stepNumber === 6) {
          const inProgressStatusId = await this.getStatusId('jobStatus', 'IN_PROGRESS');
          await tx.repairJob.update({
            where: { id: jobId },
            data: {
              jobStatusId: inProgressStatusId,
              billNo: dto.billNo ?? job.billNo,
              repairCost: dto.repairCost !== undefined ? dto.repairCost : job.repairCost,
              updatedBy: user.id,
            },
          });
        }
      } else if (currentStepActionType === StepActionType.WITH_PARTS) {
        if (stepNumber === 6) {
          // Batch Handover: Convert all PENDING_WITHDRAW to WITHDRAW at this exact timestamp
          const pendingTxns = await tx.sparepartTxn.findMany({
            where: { jobId, txnType: 'PENDING_WITHDRAW' },
          });

          for (const pTxn of pendingTxns) {
            // Deduct stock for INTERNAL items (or procures already added to stock)
            if (pTxn.stockType === 'INTERNAL') {
              const currentSp = await tx.sparepart.findUnique({
                where: { id: pTxn.sparepartId },
              });
              if (!currentSp || currentSp.qtyInStock < pTxn.qty) {
                throw new BadRequestException(
                  `Insufficient stock for spare part "${currentSp?.name || pTxn.sparepartId}". Available: ${currentSp?.qtyInStock ?? 0}, Requested: ${pTxn.qty}`,
                );
              }

              await tx.sparepart.update({
                where: { id: pTxn.sparepartId },
                data: { qtyInStock: { decrement: pTxn.qty } },
              });
            }

            await tx.sparepartTxn.update({
              where: { id: pTxn.id },
              data: {
                txnType: 'WITHDRAW',
                txnBy: user.id,
                txnDate: completionTime,
              },
            });
          }

          const inProgressStatusId = await this.getStatusId('jobStatus', 'IN_PROGRESS');
          await tx.repairJob.update({
            where: { id: jobId },
            data: { jobStatusId: inProgressStatusId, updatedBy: user.id },
          });
        }
      } else if (currentStepActionType === StepActionType.SELF_REPAIR) {
        if (stepNumber === 4) {
          const inProgressStatusId = await this.getStatusId('jobStatus', 'IN_PROGRESS');
          await tx.repairJob.update({
            where: { id: jobId },
            data: { jobStatusId: inProgressStatusId, updatedBy: user.id },
          });
        }
      }

      if (isPenultimateStep && currentStepActionType !== StepActionType.UNREPAIRABLE) {
        const waitingDeliveryStatusId = await this.getStatusId('jobStatus', 'WAITING_DELIVERY');
        await tx.repairJob.update({
          where: { id: jobId },
          data: { jobStatusId: waitingDeliveryStatusId, updatedBy: user.id },
        });
      }

      if (isFinalStep) {
        const completedStatusId = await this.getStatusId('jobStatus', 'COMPLETED');
        const normalAssetStatusId = await this.getStatusId('assetStatus', 'NORMAL');
        const waitDisposalAssetStatusId = await this.getStatusId('assetStatus', 'WAIT_DISPOSAL');
        const availableStatusId = await this.getStatusId('availabilityStatus', 'AVAILABLE');
        const unavailableStatusId = await this.getStatusId('availabilityStatus', 'UNAVAILABLE');

        await tx.repairJob.update({
          where: { id: jobId },
          data: {
            jobStatusId: completedStatusId,
            returnDate: completionTime,
            receiverId: dto.receiverId,
            warrantyDate: dto.warrantyDate,
            updatedBy: user.id,
          },
        });

        const targetAssetStatusId =
          currentStepActionType === StepActionType.UNREPAIRABLE
            ? waitDisposalAssetStatusId
            : normalAssetStatusId;
        const targetAvailabilityId =
          currentStepActionType === StepActionType.UNREPAIRABLE
            ? unavailableStatusId
            : availableStatusId;

        await tx.asset.update({
          where: { id: job.assetId },
          data: {
            asset_status_id: targetAssetStatusId,
            availability_status_id: targetAvailabilityId,
            updatedBy: user.id,
          },
        });
      }

      const updatedStep = await tx.repairJobStep.update({
        where: { id: targetStep.id },
        data: {
          completeAt: completionTime,
          completedBy: user.id,
          note: dto.note ? `${targetStep.note ? targetStep.note + ' | ' : ''}${dto.note}` : targetStep.note,
        },
        include: { stepMaster: true, user: true },
      });

      return {
        message: `Step #${stepNumber} ("${targetStep.stepMaster.label}") completed successfully`,
        step: updatedStep,
      };
    });
  }

  async advanceNextStep(
    jobId: string,
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
      },
    });

    if (!job) {
      throw new NotFoundException(`Repair job #${jobId} not found`);
    }

    if (!job.repairJobSteps || job.repairJobSteps.length === 0) {
      throw new BadRequestException(
        'This job has not been diagnosed yet. Please call /repairs/:id/diagnose first.',
      );
    }

    const nextPendingStep = job.repairJobSteps.find((s) => !s.completeAt);

    if (!nextPendingStep) {
      throw new BadRequestException(
        'All repair steps have already been completed for this job.',
      );
    }

    return this.updateStepProgress(
      jobId,
      nextPendingStep.stepMaster.stepNumber,
      dto,
      user,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Reject Step
  // ───────────────────────────────────────────────────────────────────────────

  async rejectStep(
    jobId: string,
    dto: RejectRepairStepDto,
    user: any,
  ) {
    const job = await this.prisma.repairJob.findUnique({
      where: { id: jobId },
      include: {
        jobStatus: true,
        repairJobSteps: {
          include: { stepMaster: true },
          orderBy: { stepMaster: { stepNumber: 'asc' } },
        },
      },
    });

    if (!job) throw new NotFoundException(`Repair job #${jobId} not found`);

    if (job.jobStatus.code === 'COMPLETED' || job.jobStatus.code === 'CANCELLED') {
      throw new BadRequestException(`Cannot reject a completed or cancelled repair job`);
    }

    if (job.jobStatus.code === 'PENDING_ASSIGN') {
      throw new BadRequestException(
        'This repair job has already been rejected and is awaiting re-diagnosis by the technician',
      );
    }

    if (!job.repairJobSteps || job.repairJobSteps.length === 0) {
      throw new BadRequestException('Repair job must be diagnosed before rejecting steps');
    }

    const currentStepActionType = job.repairJobSteps[0]?.stepMaster?.actionType;
    const nextPendingStep = job.repairJobSteps.find((s) => !s.completeAt);

    if (!nextPendingStep) {
      throw new BadRequestException('All repair steps have already been completed for this job');
    }

    const stepNumber = nextPendingStep.stepMaster.stepNumber;

    let isApprovalStep = false;
    if (
      (currentStepActionType === StepActionType.WITH_PARTS ||
        currentStepActionType === StepActionType.OUTSOURCE) &&
      stepNumber === 5
    ) {
      if (user.role !== UserRole.PARCEL_STAFF) {
        throw new ForbiddenException('Step #5 (Approval) rejection can only be performed by PARCEL_STAFF');
      }
      isApprovalStep = true;
    }

    if (!isApprovalStep) {
      throw new BadRequestException(
        `Step #${stepNumber} ("${nextPendingStep.stepMaster.label}") is not an approval step and cannot be rejected`,
      );
    }

    const pendingAssignStatusId = await this.getStatusId('jobStatus', 'PENDING_ASSIGN');

    return this.prisma.$transaction(async (tx) => {
      const updatedStep = await tx.repairJobStep.update({
        where: { id: nextPendingStep.id },
        data: {
          note: `[ไม่อนุมัติ] ${dto.reason}`,
          completedBy: user.id,
        },
        include: { stepMaster: true, user: true },
      });

      await tx.repairJob.update({
        where: { id: jobId },
        data: {
          jobStatusId: pendingAssignStatusId,
          updatedBy: user.id,
        },
      });

      await tx.sparepartTxn.deleteMany({
        where: { jobId, txnType: 'PENDING_WITHDRAW' },
      });

      return {
        message: `Step #${stepNumber} has been rejected. Repair job returned to PENDING_ASSIGN for re-diagnosis.`,
        step: updatedStep,
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Complete Unrepairable (Custody Handshake Flow)
  // ───────────────────────────────────────────────────────────────────────────

  async completeUnrepairable(jobId: string, dto: CompleteUnrepairableDto, user: any) {
    if (user.role !== UserRole.PARCEL_STAFF && user.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Only PARCEL_STAFF can confirm receipt of unrepairable equipment');
    }

    const job = await this.prisma.repairJob.findUnique({
      where: { id: jobId },
      include: {
        jobStatus: true,
        asset: true,
        repairJobSteps: { include: { stepMaster: true } },
      },
    });

    if (!job) {
      throw new NotFoundException(`Repair job #${jobId} not found`);
    }

    if (job.jobStatus.code !== 'UNREPAIRABLE') {
      throw new BadRequestException(
        `Job must be in UNREPAIRABLE status to complete custody handshake (Current status: ${job.jobStatus.code})`,
      );
    }

    const completedStatusId = await this.getStatusId('jobStatus', 'COMPLETED');
    const waitDisposalAssetStatusId = await this.getStatusId('assetStatus', 'WAIT_DISPOSAL');
    const unavailableAvailabilityId = await this.getStatusId('availabilityStatus', 'UNAVAILABLE');
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updatedJob = await tx.repairJob.update({
        where: { id: jobId },
        data: {
          jobStatusId: completedStatusId,
          receiverId: user.id,
          returnDate: now,
          updatedBy: user.id,
        },
      });

      await tx.asset.update({
        where: { id: job.assetId },
        data: {
          asset_status_id: waitDisposalAssetStatusId,
          availability_status_id: unavailableAvailabilityId,
          remark: dto.storageLocation
            ? `${job.asset.remark ? job.asset.remark + ' | ' : ''}สถานที่พักรอจำหน่าย: ${dto.storageLocation}`
            : job.asset.remark,
          updatedBy: user.id,
        },
      });

      for (const step of job.repairJobSteps) {
        if (!step.completeAt) {
          await tx.repairJobStep.update({
            where: { id: step.id },
            data: {
              completeAt: now,
              completedBy: user.id,
              note: dto.note ? `${step.note ? step.note + ' | ' : ''}${dto.note}` : step.note,
            },
          });
        }
      }

      return updatedJob;
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Cancel Repair Job (ยกเลิกใบงานซ่อม)
  // ───────────────────────────────────────────────────────────────────────────

  async cancelRepairJob(
    jobId: string,
    dto: CancelRepairJobDto,
    user: any,
  ) {
    if (user.role !== UserRole.MAINTENANCE_STAFF && user.role !== UserRole.MAINTENANCE_HEAD) {
      throw new ForbiddenException('Only maintenance staff or head can cancel repair jobs');
    }

    const job = await this.prisma.repairJob.findUnique({
      where: { id: jobId },
      include: {
        jobStatus: true,
        repairJobSteps: {
          include: { stepMaster: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Repair job #${jobId} not found`);
    }

    if (job.jobStatus.code === 'COMPLETED' || job.jobStatus.code === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel a repair job that is already ${job.jobStatus.code}`);
    }

    const hasProgressedPastApproval = job.repairJobSteps.some(
      (s) =>
        ((s.stepMaster?.stepNumber >= 5) ||
          (s.stepMaster?.actionType === StepActionType.SELF_REPAIR && s.stepMaster?.stepNumber >= 4)) &&
        s.completeAt !== null,
    );

    if (hasProgressedPastApproval) {
      throw new BadRequestException(
        'Cannot cancel a repair job that has already been approved or started active repair operations',
      );
    }

    const cancelledStatusId = await this.getStatusId('jobStatus', 'CANCELLED');
    const normalAssetStatusId = await this.getStatusId('assetStatus', 'NORMAL');
    const availableAvailabilityId = await this.getStatusId('availabilityStatus', 'AVAILABLE');

    return this.prisma.$transaction(async (tx) => {
      await tx.repairJob.update({
        where: { id: jobId },
        data: {
          jobStatusId: cancelledStatusId,
          solution: `[ยกเลิกงานซ่อม] ${dto.reason}`,
          updatedBy: user.id,
        },
      });

      await tx.sparepartTxn.deleteMany({
        where: { jobId, txnType: 'PENDING_WITHDRAW' },
      });

      await tx.asset.update({
        where: { id: job.assetId },
        data: {
          asset_status_id: normalAssetStatusId,
          availability_status_id: availableAvailabilityId,
          updatedBy: user.id,
        },
      });

      return this.findOne(jobId, tx);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Spare Parts Return within Repair Job
  // ───────────────────────────────────────────────────────────────────────────

  async returnSparePart(
    jobId: string,
    dto: ReturnRepairSparePartDto,
    user: any,
  ) {
    if (user.role !== UserRole.PARCEL_STAFF) {
      throw new ForbiddenException('Only PARCEL_STAFF can process return of spare parts into stock');
    }

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
      await tx.sparepart.update({
        where: { id: dto.sparepartId },
        data: { qtyInStock: { increment: dto.qty } },
      });

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

      return {
        message: `Successfully returned ${dto.qty} item(s) of "${sp.name}" to inventory`,
        transaction: txn,
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Lookups & Query
  // ───────────────────────────────────────────────────────────────────────────

  async getLookups() {
    const [causes, techCategories, jobTypes, stepMasters] = await Promise.all([
      this.prisma.cause.findMany({ where: { deleteAt: null } }),
      this.prisma.techCategory.findMany({ where: { isActive: true, deleteAt: null } }),
      this.prisma.jobType.findMany({ where: { deletedAt: null } }),
      this.prisma.stepMaster.findMany({ orderBy: [{ actionType: 'asc' }, { stepNumber: 'asc' }] }),
    ]);

    return {
      causes,
      techCategories,
      jobTypes,
      stepMasters,
    };
  }

  async findAll(query: QueryRepairJobDto, user: any) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.RepairJobWhereInput = {};

    if (user.role === UserRole.DEPARTMENT_STAFF) {
      const sectionId = await this.getCallerSectionId(user);
      if (sectionId) {
        where.sectionId = sectionId;
      }
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

    if (query.sectionId) {
      where.sectionId = query.sectionId;
    }

    if (query.assetId) {
      where.assetId = query.assetId;
    }

    if (query.reporterId) {
      where.reporterId = query.reporterId;
    }

    if (query.mechanicId) {
      where.mechanicRepairs = {
        some: { userId: query.mechanicId },
      };
    }

    if (query.startDate) {
      if (!this.isValidCalendarDate(query.startDate)) {
        throw new BadRequestException(
          `Invalid startDate format or calendar date value: "${query.startDate}". Expected a valid date in YYYY-MM-DD format.`,
        );
      }
      where.createdAt = {
        ...(where.createdAt as any),
        gte: new Date(`${query.startDate}T00:00:00.000Z`),
      };
    }

    if (query.endDate) {
      if (!this.isValidCalendarDate(query.endDate)) {
        throw new BadRequestException(
          `Invalid endDate format or calendar date value: "${query.endDate}". Expected a valid date in YYYY-MM-DD format.`,
        );
      }
      where.createdAt = {
        ...(where.createdAt as any),
        lte: new Date(`${query.endDate}T23:59:59.999Z`),
      };
    }

    if (query.isOverdue) {
      const now = new Date();
      where.dueDate = { lt: now };
      where.jobStatus = {
        code: { notIn: ['COMPLETED', 'CANCELLED'] },
      };
    }

    const search = query.search?.trim();
    if (search) {
      const searchCondition = [
        { jobNo: { contains: search, mode: 'insensitive' as const } },
        { symptom: { contains: search, mode: 'insensitive' as const } },
        { diagnosis: { contains: search, mode: 'insensitive' as const } },
        { asset: { name: { contains: search, mode: 'insensitive' as const } } },
        { asset: { noid: { contains: search, mode: 'insensitive' as const } } },
      ];
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchCondition },
        ];
        delete where.OR;
      } else {
        where.OR = searchCondition;
      }
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

    const enrichedItems = items.map((job) => {
      const overdueInfo = this.calculateOverdueInfo(job);
      return {
        ...job,
        isOverdue: overdueInfo.isOverdue,
        overdueDays: overdueInfo.overdueDays,
      };
    });

    return paginate(enrichedItems, total, page, limit);
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

    const sparePartsCost = job.sparepartTxns.reduce((acc, t) => {
      const lineCost = Number(t.unitPrice) * t.qty;
      if (t.txnType === 'WITHDRAW') return acc + lineCost;
      if (t.txnType === 'RETURN') return acc - lineCost;
      return acc;
    }, 0);

    const outsourceCost = job.repairCost ? Number(job.repairCost) : 0;
    const totalCost = Math.max(0, sparePartsCost) + outsourceCost;
    const overdueInfo = this.calculateOverdueInfo(job);

    return {
      ...job,
      isOverdue: overdueInfo.isOverdue,
      overdueDays: overdueInfo.overdueDays,
      summary: {
        outsourceCost,
        totalSparePartsCost: Math.max(0, sparePartsCost),
        totalCost,
        totalSteps: job.repairJobSteps.length,
        completedSteps: job.repairJobSteps.filter((s) => s.completeAt !== null).length,
        isOverdue: overdueInfo.isOverdue,
        overdueDays: overdueInfo.overdueDays,
      },
    };
  }

  async getMechanics() {
    return this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.MAINTENANCE_STAFF, UserRole.MAINTENANCE_HEAD] },
        deletedAt: null,
      },
      select: {
        id: true,
        employeeId: true,
        userName: true,
        firstname: true,
        lastname: true,
        email: true,
        role: true,
        imageUrl: true,
        section_id: true,
        section: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { firstname: 'asc' },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Strict Step-level Role Validation (4 Tracks)
  // ───────────────────────────────────────────────────────────────────────────

  private validateStepRole(
    actionType: StepActionType,
    stepNumber: number,
    role: UserRole,
  ) {
    const isMaintenance = role === UserRole.MAINTENANCE_STAFF || role === UserRole.MAINTENANCE_HEAD;

    // Step 5 Approval / External Handling (PARCEL_STAFF only for WITH_PARTS and OUTSOURCE)
    if (
      (actionType === StepActionType.WITH_PARTS || actionType === StepActionType.OUTSOURCE) &&
      stepNumber === 5
    ) {
      if (role !== UserRole.PARCEL_STAFF) {
        throw new ForbiddenException(
          `Step #${stepNumber} (Parcel approval/procurement) can only be performed by PARCEL_STAFF`,
        );
      }
      return;
    }

    // Step 6 Handover / Receipt:
    // - WITH_PARTS: Step 6 is mechanic receiving parts and starting repair
    if (actionType === StepActionType.WITH_PARTS && stepNumber === 6) {
      if (!isMaintenance) {
        throw new ForbiddenException(
          `Step #6 (Parts receipt & repair execution) can only be performed by MAINTENANCE_STAFF or MAINTENANCE_HEAD`,
        );
      }
      return;
    }

    // - OUTSOURCE: Step 6 is receiving machine back and testing (performed by MAINTENANCE_STAFF or MAINTENANCE_HEAD)
    if (actionType === StepActionType.OUTSOURCE && stepNumber === 6) {
      if (!isMaintenance) {
        throw new ForbiddenException(
          `Step #6 (รับเครื่องคืนและทดสอบ) can only be performed by MAINTENANCE_STAFF or MAINTENANCE_HEAD`,
        );
      }
      return;
    }

    // - UNREPAIRABLE: Step 5 is mechanic delivering machine, Step 6 is parcel staff receiving machine
    if (actionType === StepActionType.UNREPAIRABLE) {
      if (stepNumber === 5) {
        if (!isMaintenance) {
          throw new ForbiddenException(`Step #5 can only be performed by maintenance staff`);
        }
        return;
      }
      if (stepNumber >= 6) {
        if (role !== UserRole.PARCEL_STAFF) {
          throw new ForbiddenException(`Custody acceptance steps must be performed by PARCEL_STAFF`);
        }
        return;
      }
    }

    // SELF_REPAIR: Step 4 is repair execution
    if (actionType === StepActionType.SELF_REPAIR && stepNumber === 4) {
      if (!isMaintenance) {
        throw new ForbiddenException(
          `Mechanic operations can only be performed by MAINTENANCE_STAFF or MAINTENANCE_HEAD`,
        );
      }
      return;
    }

    // Final Handover & Closure Step (ช่างเป็นผู้บันทึกสรุปและส่งมอบให้หน่วยงาน)
    const isFinalStep =
      (actionType === StepActionType.SELF_REPAIR && stepNumber === 6) ||
      (actionType !== StepActionType.SELF_REPAIR && stepNumber === 8);

    if (isFinalStep && actionType !== StepActionType.UNREPAIRABLE) {
      if (!isMaintenance) {
        throw new ForbiddenException(
          `Final job completion can only be performed by MAINTENANCE_STAFF or MAINTENANCE_HEAD`,
        );
      }
      return;
    }
  }
}
