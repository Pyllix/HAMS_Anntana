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

  private isValidCalendarDate(dateStr?: string | null): boolean {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const regex = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/;
    const match = dateStr.match(regex);
    if (!match) return false;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
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

    // 1. Guard against disposed or lost asset
    if (asset.status?.code === 'DISPOSAL' || asset.status?.code === 'WAIT_DISPOSAL') {
      throw new BadRequestException(`Cannot request repair for disposed asset "${asset.name}" (${asset.noid})`);
    }
    if (asset.status?.code === 'LOST') {
      throw new BadRequestException(`Cannot request repair for lost asset "${asset.name}" (${asset.noid})`);
    }

    // 2. Guard against duplicate active repair requests for the same asset
    const activeRepairJob = await this.prisma.repairJob.findFirst({
      where: {
        assetId: dto.assetId,
        jobStatus: {
          code: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      },
      include: { jobStatus: true },
    });

    if (activeRepairJob) {
      throw new BadRequestException(
        `Asset "${asset.name}" (${asset.noid}) already has an active repair job #${activeRepairJob.jobNo} (Status: ${activeRepairJob.jobStatus?.name || activeRepairJob.jobStatus?.code})`,
      );
    }

    const underRepairStatusId = await this.getStatusId('assetStatus', 'UNDER_REPAIR');
    const unavailableAvailabilityId = await this.getStatusId('availabilityStatus', 'UNAVAILABLE');
    const pendingAssignStatusId = await this.getStatusId('jobStatus', 'PENDING_ASSIGN');

    // Default JobType to first available if not specified
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
  // 2. Diagnose and Plan (ช่างรับงาน วินิจฉัย และ Clone Steps)
  // ───────────────────────────────────────────────────────────────────────────

  async diagnoseAndPlan(id: string, dto: DiagnoseRepairJobDto, user: any) {
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

    // Guard against re-diagnosing a job that has already progressed beyond the diagnosis boundary
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

    // Validate Lookups
    const [cause, techCat, jobType] = await Promise.all([
      this.prisma.cause.findUnique({ where: { id: dto.causeId } }),
      this.prisma.techCategory.findUnique({ where: { id: dto.techCategoryId } }),
      this.prisma.jobType.findUnique({ where: { id: dto.jobTypeId } }),
    ]);

    if (!cause) throw new NotFoundException(`Cause #${dto.causeId} not found`);
    if (!techCat) throw new NotFoundException(`Tech category #${dto.techCategoryId} not found`);
    if (!jobType) throw new NotFoundException(`Job type #${dto.jobTypeId} not found`);

    // Validate dueDate calendar date format if provided
    if (dto.dueDate && !this.isValidCalendarDate(dto.dueDate)) {
      throw new BadRequestException(
        `Invalid dueDate format or calendar date value: "${dto.dueDate}". Expected a valid date in YYYY-MM-DD format.`,
      );
    }

    // 1. Validate OUTSOURCE vs Non-OUTSOURCE rules
    if (dto.stepActionType === StepActionType.OUTSOURCE) {
      if (!dto.companyId) {
        throw new BadRequestException('Company ID is required for OUTSOURCE action type');
      }
      const company = await this.prisma.company.findUnique({
        where: { id: dto.companyId, deletedAt: null },
      });
      if (!company) {
        throw new NotFoundException(`Company #${dto.companyId} not found`);
      }
      if (dto.spareParts && dto.spareParts.length > 0) {
        throw new BadRequestException('Spare parts requisition is not allowed for OUTSOURCE action type');
      }
    } else {
      if (dto.companyId) {
        throw new BadRequestException(`Company ID cannot be specified for ${dto.stepActionType} action type`);
      }
      if (dto.billNo) {
        throw new BadRequestException(`Bill number cannot be specified for ${dto.stepActionType} action type`);
      }
    }

    // 2. Validate INTERNAL_STOCK vs Other Action Types regarding spare parts
    if (dto.stepActionType === StepActionType.INTERNAL_STOCK) {
      if (!dto.spareParts || dto.spareParts.length === 0) {
        throw new BadRequestException('At least one spare part must be selected for INTERNAL_STOCK action type');
      }
    } else if (dto.spareParts && dto.spareParts.length > 0) {
      throw new BadRequestException(
        `Spare parts requisition from internal inventory is not allowed for ${dto.stepActionType} action type`,
      );
    }

    // 3. Guard against duplicate spare parts in the same request payload
    if (dto.spareParts && dto.spareParts.length > 0) {
      const spIds = dto.spareParts.map((item) => item.sparepartId);
      if (new Set(spIds).size !== spIds.length) {
        throw new BadRequestException('Duplicate spare parts found in requisition list');
      }
    }

    // Validate Mechanics: All assigned users must have role MAINTENANCE_STAFF
    const mechanicIds = dto.mechanicIds && dto.mechanicIds.length > 0 ? dto.mechanicIds : [user.id];
    for (const mechId of mechanicIds) {
      const mech = await this.prisma.user.findUnique({
        where: { id: mechId, deletedAt: null },
      });
      if (!mech) {
        throw new NotFoundException(`Mechanic user #${mechId} not found`);
      }
      if (mech.role !== UserRole.MAINTENANCE_STAFF) {
        throw new BadRequestException(
          `User "${mech.firstname} ${mech.lastname}" (${mech.id}) does not have role MAINTENANCE_STAFF (Current role: ${mech.role}). Only maintenance staff can be assigned as mechanics.`,
        );
      }
    }

    // Validate Spare Parts for INTERNAL_STOCK: Stock must not be deficient
    const sparePartMap: Record<number, any> = {};
    if (dto.spareParts && dto.spareParts.length > 0) {
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
        sparePartMap[item.sparepartId] = sp;
      }
    }

    // Determine initial JobStatus according to Action Type:
    // - INTERNAL_STOCK / EXTERNAL_STOCK / OUTSOURCE -> PARCEL_PROCESSING (ตั้งเรื่องขอเบิก/จัดซื้อ/ส่งซ่อม)
    // - PURCHASE_REPLACEMENT -> UNREPAIRABLE (แทงชำรุด/ขอซื้อทดแทน)
    // - SELF_REPAIR -> IN_PROGRESS (ช่างดำเนินการซ่อมเอง)
    let targetStatusCode = 'IN_PROGRESS';
    if (
      dto.stepActionType === StepActionType.INTERNAL_STOCK ||
      dto.stepActionType === StepActionType.EXTERNAL_STOCK ||
      dto.stepActionType === StepActionType.OUTSOURCE
    ) {
      targetStatusCode = 'PARCEL_PROCESSING';
    } else if (dto.stepActionType === StepActionType.PURCHASE_REPLACEMENT) {
      targetStatusCode = 'UNREPAIRABLE';
    }
    const initialJobStatusId = await this.getStatusId('jobStatus', targetStatusCode);

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
          jobStatusId: initialJobStatusId,
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

      // 3. Process Spare Parts Transactions (Record PENDING_WITHDRAW without deducting stock yet)
      // If re-diagnosing:
      // - If previous transactions were WITHDRAW (already approved/deducted), revert stock increment
      // - Clean up previous sparepart transactions for this job
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

      if (dto.spareParts && dto.spareParts.length > 0) {
        for (const item of dto.spareParts) {
          const sp = sparePartMap[item.sparepartId];
          // Create PENDING_WITHDRAW record in sparepart_txns (stock will be deducted upon parcel approval)
          await tx.sparepartTxn.create({
            data: {
              sparepartId: item.sparepartId,
              jobId: id,
              txnType: 'PENDING_WITHDRAW',
              qty: item.qty,
              unitPrice: sp.price,
              txnBy: user.id,
            },
          });
        }
      }

      // 4. Clone Steps from StepMaster (Delete old steps if re-diagnosing)
      // Form Boundary: Steps 1-4 are auto-completed on single form submission (or 1-3 for SELF_REPAIR)
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
  // 3. Update Step Progress
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

    // 1. Guard against duplicate step completion
    if (targetStep.completeAt) {
      throw new BadRequestException(
        `Step #${stepNumber} ("${targetStep.stepMaster.label}") has already been completed`,
      );
    }

    // 2. Guard against skipping steps (must complete in sequential order)
    const previousIncompleteStep = job.repairJobSteps.find(
      (s) => s.stepMaster.stepNumber < stepNumber && !s.completeAt,
    );
    if (previousIncompleteStep) {
      throw new BadRequestException(
        `Cannot skip to Step #${stepNumber}. Please complete Step #${previousIncompleteStep.stepMaster.stepNumber} ("${previousIncompleteStep.stepMaster.label}") first.`,
      );
    }

    // Strict Step-level Role Validation (Separation of Duties - ADMIN excluded from approval steps)
    this.validateStepRole(currentStepActionType, stepNumber, user.role);

    const totalSteps = job.repairJobSteps.length;
    const isPenultimateStep = stepNumber === totalSteps - 1; // "แล้วเสร็จ / รอตรวจรับงาน"
    const isFinalStep = stepNumber === totalSteps; // "ตรวจรับงานและสรุป Job"

    if (isFinalStep) {
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
    } else {
      if (dto.receiverId) {
        throw new BadRequestException(
          'receiverId cannot be provided before the final step (ตรวจรับงานและสรุป Job)',
        );
      }
      if (dto.warrantyDate) {
        throw new BadRequestException(
          'warrantyDate cannot be provided before the final step (ตรวจรับงานและสรุป Job)',
        );
      }
    }

    const completionTime = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Step-specific Dynamic JobStatus Transitions
      if (currentStepActionType === StepActionType.OUTSOURCE) {
        if (stepNumber === 5) {
          // อนุมัติส่งซ่อมบริษัทภายนอก -> OUTSOURCED
          const outsourcedStatusId = await this.getStatusId('jobStatus', 'OUTSOURCED');
          await tx.repairJob.update({
            where: { id: jobId },
            data: { jobStatusId: outsourcedStatusId, updatedBy: user.id },
          });
        } else if (stepNumber === 6) {
          // พัสดุรับเครื่องกลับจากบริษัท -> PARCEL_PROCESSING
          const parcelStatusId = await this.getStatusId('jobStatus', 'PARCEL_PROCESSING');
          await tx.repairJob.update({
            where: { id: jobId },
            data: { jobStatusId: parcelStatusId, updatedBy: user.id },
          });
        } else if (stepNumber === 7) {
          // ช่างรับเครื่องและทดสอบ -> IN_PROGRESS
          const inProgressStatusId = await this.getStatusId('jobStatus', 'IN_PROGRESS');
          await tx.repairJob.update({
            where: { id: jobId },
            data: { jobStatusId: inProgressStatusId, updatedBy: user.id },
          });
        }
      } else if (currentStepActionType === StepActionType.EXTERNAL_STOCK) {
        if (stepNumber === 5) {
          // อนุมัติจัดหาอะไหล่นอกคลัง -> WAITING_PARTS
          const waitingPartsStatusId = await this.getStatusId('jobStatus', 'WAITING_PARTS');
          await tx.repairJob.update({
            where: { id: jobId },
            data: { jobStatusId: waitingPartsStatusId, updatedBy: user.id },
          });
        } else if (stepNumber === 6) {
          // พัสดุแจ้งรับอะไหล่ -> PARCEL_PROCESSING
          const parcelStatusId = await this.getStatusId('jobStatus', 'PARCEL_PROCESSING');
          await tx.repairJob.update({
            where: { id: jobId },
            data: { jobStatusId: parcelStatusId, updatedBy: user.id },
          });
        } else if (stepNumber === 7) {
          // ช่างรับอะไหล่/ดำเนินการซ่อม -> IN_PROGRESS
          const inProgressStatusId = await this.getStatusId('jobStatus', 'IN_PROGRESS');
          await tx.repairJob.update({
            where: { id: jobId },
            data: { jobStatusId: inProgressStatusId, updatedBy: user.id },
          });
        }
      } else if (currentStepActionType === StepActionType.INTERNAL_STOCK) {
        if (stepNumber === 5) {
          // Parcel approves spare parts requisition (Step 5: อนุมัติจัดหาอะไหล่ในคลัง):
          // 1. Verify current stock availability for all pending items
          const pendingTxns = await tx.sparepartTxn.findMany({
            where: { jobId, txnType: 'PENDING_WITHDRAW' },
          });

          for (const pTxn of pendingTxns) {
            const currentSp = await tx.sparepart.findUnique({
              where: { id: pTxn.sparepartId },
            });
            if (!currentSp || currentSp.qtyInStock < pTxn.qty) {
              throw new BadRequestException(
                `Insufficient stock for spare part "${currentSp?.name || pTxn.sparepartId}" upon approval. Available: ${currentSp?.qtyInStock ?? 0}, Requested: ${pTxn.qty}`,
              );
            }

            // 2. Deduct stock from inventory
            await tx.sparepart.update({
              where: { id: pTxn.sparepartId },
              data: { qtyInStock: { decrement: pTxn.qty } },
            });

            // 3. Transition transaction from PENDING_WITHDRAW to WITHDRAW
            await tx.sparepartTxn.update({
              where: { id: pTxn.id },
              data: {
                txnType: 'WITHDRAW',
                txnBy: user.id,
                txnDate: completionTime,
              },
            });
          }
        } else if (stepNumber === 6 || stepNumber === 7) {
          // พัสดุจ่ายอะไหล่ / ช่างรับวัสดุและซ่อม -> IN_PROGRESS
          const inProgressStatusId = await this.getStatusId('jobStatus', 'IN_PROGRESS');
          await tx.repairJob.update({
            where: { id: jobId },
            data: { jobStatusId: inProgressStatusId, updatedBy: user.id },
          });
        }
      } else if (currentStepActionType === StepActionType.PURCHASE_REPLACEMENT) {
        if (stepNumber === 5 || stepNumber === 6 || stepNumber === 7) {
          // Step 5: พัสดุตรวจ, Step 6: ผู้บริหารอนุมัติ, Step 7: พัสดุรับเครื่องใหม่ -> PARCEL_PROCESSING
          const parcelStatusId = await this.getStatusId('jobStatus', 'PARCEL_PROCESSING');
          await tx.repairJob.update({
            where: { id: jobId },
            data: { jobStatusId: parcelStatusId, updatedBy: user.id },
          });
        } else if (stepNumber === 8) {
          // Step 8: ช่างรับเครื่องใหม่และส่งมอบ -> IN_PROGRESS
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

      // If penultimate step (แล้วเสร็จ / รอตรวจรับงาน) -> set status to WAITING_DELIVERY
      if (isPenultimateStep) {
        const waitingDeliveryStatusId = await this.getStatusId('jobStatus', 'WAITING_DELIVERY');
        await tx.repairJob.update({
          where: { id: jobId },
          data: { jobStatusId: waitingDeliveryStatusId, updatedBy: user.id },
        });
      }

      // If final step (ตรวจรับงานและสรุป Job) -> set status to COMPLETED and update returnDate
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

        // For PURCHASE_REPLACEMENT, original asset goes to WAIT_DISPOSAL / UNAVAILABLE
        const targetAssetStatusId =
          currentStepActionType === StepActionType.PURCHASE_REPLACEMENT
            ? waitDisposalAssetStatusId
            : normalAssetStatusId;
        const targetAvailabilityId =
          currentStepActionType === StepActionType.PURCHASE_REPLACEMENT
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
  // 3.1 Advance Next Step Automatically
  // ───────────────────────────────────────────────────────────────────────────

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

    if (job.repairJobSteps.length === 0) {
      throw new BadRequestException('Repair job must be diagnosed before advancing steps');
    }

    const nextPendingStep = job.repairJobSteps.find((s) => !s.completeAt);
    if (!nextPendingStep) {
      throw new BadRequestException('All repair steps have already been completed for this job');
    }

    return this.updateStepProgress(
      jobId,
      nextPendingStep.stepMaster.stepNumber,
      dto,
      user,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3.2 Reject / Disapprove Approval Step (ตีกลับ/ไม่อนุมัติ)
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

    if (!job) {
      throw new NotFoundException(`Repair job #${jobId} not found`);
    }

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

    // Strict validation: Only approval steps can be rejected by their designated roles
    let isApprovalStep = false;
    if (
      (currentStepActionType === StepActionType.INTERNAL_STOCK ||
        currentStepActionType === StepActionType.EXTERNAL_STOCK ||
        currentStepActionType === StepActionType.OUTSOURCE) &&
      stepNumber === 5
    ) {
      if (user.role !== UserRole.PARCEL_STAFF) {
        throw new ForbiddenException('Step #5 (Approval) rejection can only be performed by PARCEL_STAFF');
      }
      isApprovalStep = true;
    } else if (currentStepActionType === StepActionType.PURCHASE_REPLACEMENT) {
      if (stepNumber === 5) {
        if (user.role !== UserRole.PARCEL_STAFF) {
          throw new ForbiddenException('Step #5 (Parcel Review) rejection can only be performed by PARCEL_STAFF');
        }
        isApprovalStep = true;
      } else if (stepNumber === 6) {
        if (user.role !== UserRole.MANAGER) {
          throw new ForbiddenException('Step #6 (Executive Approval) rejection can only be performed by MANAGER');
        }
        isApprovalStep = true;
      }
    }

    if (!isApprovalStep) {
      throw new BadRequestException(
        `Step #${stepNumber} ("${nextPendingStep.stepMaster.label}") is not an approval step and cannot be rejected`,
      );
    }

    const pendingAssignStatusId = await this.getStatusId('jobStatus', 'PENDING_ASSIGN');

    return this.prisma.$transaction(async (tx) => {
      // 1. Record rejection note and user on the pending step
      const updatedStep = await tx.repairJobStep.update({
        where: { id: nextPendingStep.id },
        data: {
          note: `[ไม่อนุมัติ] ${dto.reason}`,
          completedBy: user.id,
        },
        include: { stepMaster: true, user: true },
      });

      // 2. Revert job status back to PENDING_ASSIGN so technician can re-diagnose
      await tx.repairJob.update({
        where: { id: jobId },
        data: {
          jobStatusId: pendingAssignStatusId,
          updatedBy: user.id,
        },
      });

      // 3. Clear any PENDING_WITHDRAW transactions to free up reserved inventory
      await tx.sparepartTxn.deleteMany({
        where: { jobId, txnType: 'PENDING_WITHDRAW' },
      });

      return {
        message: 'Step rejected successfully. The repair job has been returned for re-diagnosis.',
        step: updatedStep,
        job: await this.findOne(jobId, tx),
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3.3 Cancel Repair Job (ยกเลิกใบงานซ่อมโดยช่าง)
  // ───────────────────────────────────────────────────────────────────────────

  async cancelRepairJob(
    jobId: string,
    dto: CancelRepairJobDto,
    user: any,
  ) {
    if (user.role !== UserRole.MAINTENANCE_STAFF) {
      throw new ForbiddenException('Only maintenance staff (technicians) can cancel repair jobs');
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

    // Check if the job has already progressed past the diagnosis/approval phase
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
      // 1. Update job to CANCELLED
      await tx.repairJob.update({
        where: { id: jobId },
        data: {
          jobStatusId: cancelledStatusId,
          solution: `[ยกเลิกงานซ่อม] ${dto.reason}`,
          updatedBy: user.id,
        },
      });

      // 2. Clear any PENDING_WITHDRAW transactions
      await tx.sparepartTxn.deleteMany({
        where: { jobId, txnType: 'PENDING_WITHDRAW' },
      });

      // 3. Revert Asset status to NORMAL and AVAILABLE
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
  // 4. Spare Parts Return within Repair Job
  // ───────────────────────────────────────────────────────────────────────────

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
  // 5. Find All & Query
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
      if (t.txnType === 'WITHDRAW') return acc + lineCost;
      if (t.txnType === 'RETURN') return acc - lineCost;
      return acc;
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

  async getMechanics() {
    return this.prisma.user.findMany({
      where: {
        role: UserRole.MAINTENANCE_STAFF,
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

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Strict Step-level Role Validation (Separation of Duties)
  // ───────────────────────────────────────────────────────────────────────────

  private validateStepRole(
    actionType: StepActionType,
    stepNumber: number,
    role: UserRole,
  ) {
    // 1. Approvals: Step 5 for Stock/Outsource/Replacement (PARCEL_STAFF only), Step 6 for Replacement (MANAGER only)
    if (
      (actionType === StepActionType.INTERNAL_STOCK ||
        actionType === StepActionType.EXTERNAL_STOCK ||
        actionType === StepActionType.OUTSOURCE) &&
      stepNumber === 5
    ) {
      if (role !== UserRole.PARCEL_STAFF) {
        throw new ForbiddenException(
          `Step #${stepNumber} (Approval) can only be performed by PARCEL_STAFF`,
        );
      }
      return;
    }

    if (actionType === StepActionType.PURCHASE_REPLACEMENT) {
      if (stepNumber === 5) {
        // Step 5: พัสดุตรวจสอบและเสนอความเห็น -> PARCEL_STAFF only
        if (role !== UserRole.PARCEL_STAFF) {
          throw new ForbiddenException(
            `Step #5 (Parcel Review) can only be performed by PARCEL_STAFF`,
          );
        }
        return;
      }
      if (stepNumber === 6) {
        // Step 6: ผู้บริหารอนุมัติการจัดซื้อเครื่องทดแทน -> MANAGER only
        if (role !== UserRole.MANAGER) {
          throw new ForbiddenException(
            `Step #6 (Executive Approval) can only be performed by MANAGER`,
          );
        }
        return;
      }
    }

    // 2. Parcel Handling: Step 6 for Stock/Outsource, Step 7 for Replacement (PARCEL_STAFF only)
    if (
      ((actionType === StepActionType.INTERNAL_STOCK ||
        actionType === StepActionType.EXTERNAL_STOCK ||
        actionType === StepActionType.OUTSOURCE) &&
        stepNumber === 6) ||
      (actionType === StepActionType.PURCHASE_REPLACEMENT && stepNumber === 7)
    ) {
      if (role !== UserRole.PARCEL_STAFF) {
        throw new ForbiddenException(
          `Parcel handover steps can only be performed by PARCEL_STAFF`,
        );
      }
      return;
    }

    // 3. Mechanic Operations: Step 4 for SELF_REPAIR, Step 7 for Stock/Outsource, Step 8 for Replacement
    if (
      (actionType === StepActionType.SELF_REPAIR && stepNumber === 4) ||
      ((actionType === StepActionType.INTERNAL_STOCK ||
        actionType === StepActionType.EXTERNAL_STOCK ||
        actionType === StepActionType.OUTSOURCE) &&
        stepNumber === 7) ||
      (actionType === StepActionType.PURCHASE_REPLACEMENT && stepNumber === 8)
    ) {
      if (role !== UserRole.MAINTENANCE_STAFF) {
        throw new ForbiddenException(
          `Mechanic operations can only be performed by MAINTENANCE_STAFF`,
        );
      }
      return;
    }

    // 4. Final Handover & Closure Step (ช่างเป็นผู้บันทึกสรุปและส่งมอบให้หน่วยงาน)
    const isFinalStep =
      (actionType === StepActionType.SELF_REPAIR && stepNumber === 6) ||
      (actionType === StepActionType.PURCHASE_REPLACEMENT && stepNumber === 10) ||
      (actionType !== StepActionType.SELF_REPAIR &&
        actionType !== StepActionType.PURCHASE_REPLACEMENT &&
        stepNumber === 9);

    if (isFinalStep) {
      if (role !== UserRole.MAINTENANCE_STAFF) {
        throw new ForbiddenException(
          `Final job completion can only be performed by MAINTENANCE_STAFF`,
        );
      }
      return;
    }
  }
}
