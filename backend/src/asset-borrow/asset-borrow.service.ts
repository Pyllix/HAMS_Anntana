import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAssetBorrowDto } from './dto/create-asset-borrow.dto';
import { ReturnAssetBorrowDto } from './dto/return-asset-borrow.dto';
import { BorrowFilterDto } from './dto/borrow-filter.dto';
import { CancelBorrowDto } from './dto/cancel-borrow.dto';
import { paginate, PaginatedResult } from '../common/utils/paginate.util';
import { ReturnCondition, UserRole, RequestSource } from '@prisma/client';

@Injectable()
export class AssetBorrowService {
  constructor(private prisma: PrismaService) { }

  private async getStatusId(model: 'availabilityStatus' | 'borrowStatus' | 'assetStatus', code: string): Promise<number> {
    const status = await (this.prisma[model] as any).findUnique({
      where: { code },
    });
    if (!status) {
      throw new Error(`Status code '${code}' not found in ${model}`);
    }
    return status.id;
  }

  private async getCallerSectionId(user: any, tx?: any): Promise<string | null> {
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

  async createBorrow(dto: CreateAssetBorrowDto, user: any) {
    // Determine RequestSource from user role
    let requestSource: RequestSource;
    if (user.role === UserRole.PARCEL_STAFF || user.role === UserRole.DEPARTMENT_STAFF) {
      requestSource = RequestSource.SELF_SERVICE;
    } else if (user.role === UserRole.ASSET_CENTER_STAFF) {
      requestSource = RequestSource.CENTER_SERVICE;
    } else {
      throw new BadRequestException('Only Parcel/Department Staff or Asset Center Staff can create a borrow transaction');
    }

    // Determine borrower
    let borrowerId: string;
    if (requestSource === RequestSource.SELF_SERVICE) {
      // Self service: always use the user who created the transaction, ignore dto.borrowerId
      borrowerId = user.id;
    } else {
      // Center service (Asset Center Staff): allow borrowing on behalf of someone else
      if (!dto.borrowerId) {
        throw new BadRequestException('Borrower ID is required when Asset Center Staff creates a transaction for someone else');
      }
      const targetUser = await this.prisma.user.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { id: dto.borrowerId },
            { employeeId: dto.borrowerId },
          ],
        },
      });
      if (!targetUser) {
        throw new NotFoundException(`Borrower not found with ID or Employee Code: ${dto.borrowerId}`);
      }
      borrowerId = targetUser.id;
    }

    const normalAssetStatusId = await this.getStatusId('assetStatus', 'NORMAL');
    const availableStatusId = await this.getStatusId('availabilityStatus', 'AVAILABLE');
    const reservedAvailabilityId = await this.getStatusId('availabilityStatus', 'RESERVED');
    const borrowedAvailabilityId = await this.getStatusId('availabilityStatus', 'BORROWED');

    const pendingTxStatusId = await this.getStatusId('borrowStatus', 'PENDING_APPROVAL');
    const borrowedTxStatusId = await this.getStatusId('borrowStatus', 'BORROWED');

    const targetAvailabilityId =
      requestSource === RequestSource.SELF_SERVICE
        ? reservedAvailabilityId
        : borrowedAvailabilityId;

    const targetTxStatusId =
      requestSource === RequestSource.SELF_SERVICE
        ? pendingTxStatusId
        : borrowedTxStatusId;

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Asset availability atomically only if NORMAL and AVAILABLE
      const assetUpdate = await tx.asset.updateMany({
        where: {
          id: dto.assetId,
          asset_status_id: normalAssetStatusId,
          availability_status_id: availableStatusId,
        },
        data: { availability_status_id: targetAvailabilityId },
      });

      if (assetUpdate.count === 0) {
        throw new ConflictException(`Asset with ID ${dto.assetId} is not available for borrowing (must be in NORMAL condition and AVAILABLE).`);
      }

      // 2. Create BorrowTransaction
      const transaction = await tx.borrowTransaction.create({
        data: {
          asset_id: dto.assetId,
          borrower_id: borrowerId,
          borrow_status_id: targetTxStatusId,
          request_source: requestSource,
          delivery_method: dto.deliveryMethod,
          approved_at: requestSource === RequestSource.CENTER_SERVICE ? now : null,
          handover_date: requestSource === RequestSource.CENTER_SERVICE ? now : null,
        }
      });

      return transaction;
    });
  }

  async approveBorrow(id: string, user: any) {
    const pendingTxStatusId = await this.getStatusId('borrowStatus', 'PENDING_APPROVAL');
    const approvedTxStatusId = await this.getStatusId('borrowStatus', 'APPROVED');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.borrowTransaction.findUnique({
        where: { id },
        select: { id: true, asset_id: true, borrow_status_id: true }
      });

      if (!transaction) {
        throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
      }

      if (transaction.borrow_status_id !== pendingTxStatusId) {
        throw new BadRequestException(`Only transactions in PENDING_APPROVAL status can be approved`);
      }

      // Optimistic lock on BorrowTransaction update to APPROVED
      const txUpdate = await tx.borrowTransaction.updateMany({
        where: { id, borrow_status_id: pendingTxStatusId },
        data: {
          borrow_status_id: approvedTxStatusId,
          approved_at: new Date(),
        }
      });

      if (txUpdate.count === 0) {
        throw new ConflictException(`Transaction with ID ${id} has already been processed or status changed`);
      }

      return tx.borrowTransaction.findUnique({ where: { id } });
    });
  }

  async handoverAsset(id: string, user: any) {
    const approvedTxStatusId = await this.getStatusId('borrowStatus', 'APPROVED');
    const borrowedTxStatusId = await this.getStatusId('borrowStatus', 'BORROWED');
    const reservedAvailabilityId = await this.getStatusId('availabilityStatus', 'RESERVED');
    const borrowedAvailabilityId = await this.getStatusId('availabilityStatus', 'BORROWED');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.borrowTransaction.findUnique({
        where: { id },
        select: { id: true, asset_id: true, borrow_status_id: true }
      });

      if (!transaction) {
        throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
      }

      if (transaction.borrow_status_id !== approvedTxStatusId) {
        throw new BadRequestException(`Only transactions in APPROVED status can be handed over (marked as BORROWED)`);
      }

      // Optimistic lock on BorrowTransaction update to BORROWED
      const txUpdate = await tx.borrowTransaction.updateMany({
        where: { id, borrow_status_id: approvedTxStatusId },
        data: {
          borrow_status_id: borrowedTxStatusId,
          handover_date: new Date(),
        }
      });

      if (txUpdate.count === 0) {
        throw new ConflictException(`Transaction with ID ${id} has already been processed or status changed`);
      }

      // Optimistic lock on Asset update: RESERVED -> BORROWED
      const assetUpdate = await tx.asset.updateMany({
        where: { id: transaction.asset_id, availability_status_id: reservedAvailabilityId },
        data: { availability_status_id: borrowedAvailabilityId }
      });

      if (assetUpdate.count === 0) {
        throw new ConflictException(`Asset availability for ID ${transaction.asset_id} has already changed`);
      }

      return tx.borrowTransaction.findUnique({ where: { id } });
    });
  }

  async rejectBorrow(id: string, reason: string | undefined, user: any) {
    const pendingTxStatusId = await this.getStatusId('borrowStatus', 'PENDING_APPROVAL');
    const rejectedTxStatusId = await this.getStatusId('borrowStatus', 'REJECTED');
    const reservedAvailabilityId = await this.getStatusId('availabilityStatus', 'RESERVED');
    const availableStatusId = await this.getStatusId('availabilityStatus', 'AVAILABLE');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.borrowTransaction.findUnique({
        where: { id },
        select: { id: true, asset_id: true, borrow_status_id: true }
      });

      if (!transaction) {
        throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
      }

      if (transaction.borrow_status_id !== pendingTxStatusId) {
        throw new BadRequestException(`Only transactions in PENDING_APPROVAL status can be rejected`);
      }

      // Optimistic lock on BorrowTransaction update
      const txUpdate = await tx.borrowTransaction.updateMany({
        where: { id, borrow_status_id: pendingTxStatusId },
        data: {
          borrow_status_id: rejectedTxStatusId,
          reject_reason: reason,
          rejected_at: new Date(),
        }
      });

      if (txUpdate.count === 0) {
        throw new ConflictException(`Transaction with ID ${id} has already been processed or status changed`);
      }

      // Optimistic lock on Asset update
      await tx.asset.updateMany({
        where: { id: transaction.asset_id, availability_status_id: reservedAvailabilityId },
        data: { availability_status_id: availableStatusId }
      });

      return tx.borrowTransaction.findUnique({ where: { id } });
    });
  }

  async returnAsset(id: string, dto: ReturnAssetBorrowDto, user: any) {
    const borrowedTxStatusId = await this.getStatusId('borrowStatus', 'BORROWED');
    const returnedTxStatusId = await this.getStatusId('borrowStatus', 'RETURNED');
    const borrowedAvailabilityId = await this.getStatusId('availabilityStatus', 'BORROWED');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.borrowTransaction.findUnique({
        where: { id },
        select: {
          id: true,
          asset_id: true,
          borrow_status_id: true,
          borrower_id: true,
          borrower: {
            select: { section_id: true }
          },
          borrowStatus: {
            select: { code: true, name: true }
          }
        }
      });

      if (!transaction) {
        throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
      }

      if (transaction.borrow_status_id !== borrowedTxStatusId) {
        const currentStatusCode = transaction.borrowStatus?.code || transaction.borrow_status_id;
        throw new BadRequestException(
          `Cannot return asset: transaction is currently in '${currentStatusCode}' status (expected BORROWED).`
        );
      }

      const isStaffOverride =
        user.role === UserRole.ASSET_CENTER_STAFF ||
        user.role === UserRole.ADMIN ||
        user.role === UserRole.MANAGER;

      const callerSectionId = await this.getCallerSectionId(user, tx);

      const isSameDepartment =
        callerSectionId &&
        transaction.borrower?.section_id &&
        callerSectionId === transaction.borrower.section_id;

      const isBorrower = user.id === transaction.borrower_id;

      if (!isStaffOverride && !isBorrower && !isSameDepartment) {
        throw new BadRequestException('You do not have permission to return this borrowed asset (must be in the same department as the borrower)');
      }

      let receivedByUserId: string | null = null;
      let returnedByUserId: string = user.id;

      if (isStaffOverride && dto.returnedByUserId) {
        const retUser = await tx.user.findFirst({
          where: {
            deletedAt: null,
            OR: [
              { id: dto.returnedByUserId },
              { employeeId: dto.returnedByUserId }
            ]
          }
        });
        if (!retUser) {
          throw new NotFoundException(`Returned by user not found with ID or Employee Code: ${dto.returnedByUserId}`);
        }
        returnedByUserId = retUser.id;
      } else if (user.role === UserRole.ASSET_CENTER_STAFF) {
        returnedByUserId = transaction.borrower_id;
      }

      if (user.role === UserRole.ASSET_CENTER_STAFF) {
        // Only Asset Center Staff acts as the receiver
        receivedByUserId = user.id;
      }

      // Optimistic lock on BorrowTransaction update
      const txUpdate = await tx.borrowTransaction.updateMany({
        where: { id, borrow_status_id: borrowedTxStatusId },
        data: {
          borrow_status_id: returnedTxStatusId,
          return_date: new Date(),
          return_condition: dto.returnCondition,
          return_method: dto.returnMethod,
          return_remark: dto.returnRemark,
          returned_by_user_id: returnedByUserId,
          received_by_user_id: receivedByUserId,
        }
      });

      if (txUpdate.count === 0) {
        throw new ConflictException(`Transaction with ID ${id} has already been processed or status changed`);
      }

      // Update Asset Availability and Status
      if (dto.returnCondition === ReturnCondition.Normal) {
        const availableStatusId = await this.getStatusId('availabilityStatus', 'AVAILABLE');
        await tx.asset.updateMany({
          where: { id: transaction.asset_id, availability_status_id: borrowedAvailabilityId },
          data: { availability_status_id: availableStatusId }
        });
      } else if (dto.returnCondition === ReturnCondition.Damage) {
        const unavailableStatusId = await this.getStatusId('availabilityStatus', 'UNAVAILABLE');
        const damagedStatusId = await this.getStatusId('assetStatus', 'DAMAGED');

        await tx.asset.updateMany({
          where: { id: transaction.asset_id, availability_status_id: borrowedAvailabilityId },
          data: {
            availability_status_id: unavailableStatusId,
            asset_status_id: damagedStatusId
          }
        });
      }

      return tx.borrowTransaction.findUnique({ where: { id } });
    });
  }

  async cancelBorrow(id: string, dto: CancelBorrowDto, user: any) {
    const pendingTxStatusId = await this.getStatusId('borrowStatus', 'PENDING_APPROVAL');
    const approvedTxStatusId = await this.getStatusId('borrowStatus', 'APPROVED');
    const borrowedTxStatusId = await this.getStatusId('borrowStatus', 'BORROWED');
    const cancelledTxStatusId = await this.getStatusId('borrowStatus', 'CANCELLED');
    const reservedAvailabilityId = await this.getStatusId('availabilityStatus', 'RESERVED');
    const availableStatusId = await this.getStatusId('availabilityStatus', 'AVAILABLE');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.borrowTransaction.findUnique({
        where: { id },
        select: {
          id: true,
          asset_id: true,
          borrow_status_id: true,
          borrower_id: true,
          borrower: {
            select: { section_id: true }
          },
          borrowStatus: {
            select: { code: true, name: true }
          }
        }
      });

      if (!transaction) {
        throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
      }

      const isStaffOverride =
        user.role === UserRole.ASSET_CENTER_STAFF ||
        user.role === UserRole.ADMIN ||
        user.role === UserRole.MANAGER;

      // Business Rule: BORROWED status cannot be cancelled by anyone (must use returnAsset)
      if (transaction.borrow_status_id === borrowedTxStatusId) {
        throw new BadRequestException(
          'Cannot cancel a transaction that has already been dispatched (BORROWED). The asset must be returned via return flow.'
        );
      }

      // Business Rule: Department Staff / Borrower can only cancel PENDING_APPROVAL transactions
      if (!isStaffOverride && transaction.borrow_status_id === approvedTxStatusId) {
        throw new BadRequestException(
          'Department staff can only cancel transactions that are pending approval. Please contact Asset Center Staff to cancel an approved request.'
        );
      }

      if (
        transaction.borrow_status_id !== approvedTxStatusId &&
        transaction.borrow_status_id !== pendingTxStatusId
      ) {
        const currentStatusCode = transaction.borrowStatus?.code || transaction.borrow_status_id;
        throw new BadRequestException(
          `Only pending (PENDING_APPROVAL) or approved (APPROVED) transactions can be cancelled. Current status is '${currentStatusCode}'.`
        );
      }

      const callerSectionId = await this.getCallerSectionId(user, tx);

      const isSameDepartment =
        callerSectionId &&
        transaction.borrower?.section_id &&
        callerSectionId === transaction.borrower.section_id;

      const isBorrower = user.id === transaction.borrower_id;

      if (!isStaffOverride && !isBorrower && !isSameDepartment) {
        throw new BadRequestException('You do not have permission to cancel this transaction (must be borrower or in the same department)');
      }

      // Optimistic lock on BorrowTransaction update
      const txUpdate = await tx.borrowTransaction.updateMany({
        where: {
          id,
          borrow_status_id: transaction.borrow_status_id // ensure status hasn't changed since read
        },
        data: {
          borrow_status_id: cancelledTxStatusId,
          cancelled_at: new Date(),
          cancel_reason: dto?.cancelReason || null,
        }
      });

      if (txUpdate.count === 0) {
        throw new ConflictException(`Transaction with ID ${id} has already been processed or status changed`);
      }

      // Optimistic lock on Asset update: return RESERVED -> AVAILABLE
      await tx.asset.updateMany({
        where: {
          id: transaction.asset_id,
          availability_status_id: reservedAvailabilityId,
        },
        data: { availability_status_id: availableStatusId }
      });

      return tx.borrowTransaction.findUnique({ where: { id } });
    });
  }

  async findAll(query: BorrowFilterDto, user?: any): Promise<PaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.assetId) where.asset_id = query.assetId;

    if (user?.role === UserRole.DEPARTMENT_STAFF) {
      const callerSectionId = await this.getCallerSectionId(user);
      // Department staff can view borrowings in their department (or their own)
      if (callerSectionId) {
        where.borrower = { section_id: callerSectionId };
      } else {
        where.borrower_id = user.id;
      }
    } else if (query.borrowerId) {
      const targetUser = await this.prisma.user.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { id: query.borrowerId },
            { employeeId: query.borrowerId }
          ]
        }
      });
      where.borrower_id = targetUser ? targetUser.id : query.borrowerId;
    }

    if (query.borrowStatusId) where.borrow_status_id = query.borrowStatusId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.borrowTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          asset: { select: { id: true, name: true, model: true } },
          borrower: { select: { id: true, employeeId: true, firstname: true, lastname: true, section_id: true } },
          borrowStatus: { select: { id: true, code: true, name: true } }
        }
      }),
      this.prisma.borrowTransaction.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, user?: any) {
    const transaction = await this.prisma.borrowTransaction.findUnique({
      where: { id },
      include: {
        asset: { select: { id: true, name: true, model: true } },
        borrower: { select: { id: true, employeeId: true, firstname: true, lastname: true, section_id: true } },
        returnedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
        receivedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
        borrowStatus: { select: { id: true, code: true, name: true } }
      }
    });

    if (!transaction) {
      throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
    }
    // [AuthZ] Check Permission
    if (user?.role === UserRole.DEPARTMENT_STAFF) {
      const callerSectionId = await this.getCallerSectionId(user);
      const isOwner = transaction.borrower_id === user.id;
      const isSameDept =
        callerSectionId &&
        transaction.borrower?.section_id &&
        callerSectionId === transaction.borrower.section_id;

      if (!isOwner && !isSameDept) {
        throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
      }
    }

    return transaction;
  }
}
