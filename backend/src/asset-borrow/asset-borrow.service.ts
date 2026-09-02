import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAssetBorrowDto } from './dto/create-asset-borrow.dto';
import { ReturnAssetBorrowDto } from './dto/return-asset-borrow.dto';
import { RequestReturnBorrowDto } from './dto/request-return-borrow.dto';
import { CompleteReturnBorrowDto } from './dto/complete-return-borrow.dto';
import { BorrowFilterDto } from './dto/borrow-filter.dto';
import { CancelBorrowDto } from './dto/cancel-borrow.dto';
import { paginate, PaginatedResult } from '../common/utils/paginate.util';
import { ReturnCondition, ReturnMethod, UserRole, RequestSource } from '@prisma/client';

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

    const pendingTxStatusId = await this.getStatusId('borrowStatus', 'PENDING_APPROVE');
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
      // 1. Verify Asset exists, belongs to Asset Center, and is eligible
      const existingAsset = await tx.asset.findUnique({
        where: { id: dto.assetId },
        include: { status: true, availabilityStatus: true, section: true },
      });

      if (!existingAsset) {
        throw new NotFoundException(`Asset with ID ${dto.assetId} not found`);
      }

      if (existingAsset.section?.code !== 'CENTER') {
        const sectionName = existingAsset.section?.name || 'Unknown Section';
        throw new BadRequestException(
          `Cannot borrow asset: Asset belongs to department '${sectionName}'. Only assets belonging to the Asset Center (CENTER) can be borrowed.`
        );
      }

      if (
        existingAsset.asset_status_id !== normalAssetStatusId ||
        existingAsset.availability_status_id !== availableStatusId
      ) {
        const availName = existingAsset.availabilityStatus?.name || 'Not Available';
        const statusName = existingAsset.status?.name || 'Unknown';
        throw new ConflictException(
          `Asset with ID ${dto.assetId} is not available for borrowing (Current Availability: '${availName}', Physical Status: '${statusName}'). Must be in NORMAL condition and AVAILABLE.`
        );
      }

      // 2. Update Asset availability atomically only if NORMAL and AVAILABLE
      const assetUpdate = await tx.asset.updateMany({
        where: {
          id: dto.assetId,
          asset_status_id: normalAssetStatusId,
          availability_status_id: availableStatusId,
        },
        data: { availability_status_id: targetAvailabilityId },
      });

      if (assetUpdate.count === 0) {
        throw new ConflictException(
          `Asset with ID ${dto.assetId} has just been borrowed or reserved by another transaction.`
        );
      }

      // 3. Create BorrowTransaction
      const transaction = await tx.borrowTransaction.create({
        data: {
          asset_id: dto.assetId,
          borrower_id: borrowerId,
          created_by_user_id: user.id,
          borrow_status_id: targetTxStatusId,
          request_source: requestSource,
          delivery_method: dto.deliveryMethod,
          approved_at: requestSource === RequestSource.CENTER_SERVICE ? now : null,
          approved_by_user_id: requestSource === RequestSource.CENTER_SERVICE ? user.id : null,
          handover_date: requestSource === RequestSource.CENTER_SERVICE ? now : null,
          handover_by_user_id: requestSource === RequestSource.CENTER_SERVICE ? user.id : null,
        }
      });

      return transaction;
    });
  }

  async approveBorrow(id: string, user: any) {
    const pendingTxStatusId = await this.getStatusId('borrowStatus', 'PENDING_APPROVE');
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
        throw new BadRequestException(`Only transactions in PENDING_APPROVE status can be approved`);
      }

      // Optimistic lock on BorrowTransaction update to APPROVED
      const txUpdate = await tx.borrowTransaction.updateMany({
        where: { id, borrow_status_id: pendingTxStatusId },
        data: {
          borrow_status_id: approvedTxStatusId,
          approved_at: new Date(),
          approved_by_user_id: user.id,
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
          handover_by_user_id: user.id,
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
    const pendingTxStatusId = await this.getStatusId('borrowStatus', 'PENDING_APPROVE');
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
        throw new BadRequestException(`Only transactions in PENDING_APPROVE status can be rejected`);
      }

      // Optimistic lock on BorrowTransaction update
      const txUpdate = await tx.borrowTransaction.updateMany({
        where: { id, borrow_status_id: pendingTxStatusId },
        data: {
          borrow_status_id: rejectedTxStatusId,
          reject_remark: reason,
          rejected_at: new Date(),
          rejected_by_user_id: user.id,
        }
      });

      if (txUpdate.count === 0) {
        throw new ConflictException(`Transaction with ID ${id} has already been processed or status changed`);
      }

      // Optimistic lock on Asset update
      const assetUpdate = await tx.asset.updateMany({
        where: { id: transaction.asset_id, availability_status_id: reservedAvailabilityId },
        data: { availability_status_id: availableStatusId }
      });

      if (assetUpdate.count === 0) {
        throw new ConflictException(
          `Failed to restore asset availability for asset ${transaction.asset_id}: asset availability has already changed`
        );
      }

      return tx.borrowTransaction.findUnique({ where: { id } });
    });
  }

  async requestReturn(id: string, dto: RequestReturnBorrowDto, user: any) {
    const borrowedTxStatusId = await this.getStatusId('borrowStatus', 'BORROWED');
    const pendingReturnTxStatusId = await this.getStatusId('borrowStatus', 'PENDING_RETURN');
    const borrowedAvailabilityId = await this.getStatusId('availabilityStatus', 'BORROWED');
    const unavailableAvailabilityId = await this.getStatusId('availabilityStatus', 'UNAVAILABLE');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.borrowTransaction.findUnique({
        where: { id },
        select: {
          id: true,
          asset_id: true,
          borrow_status_id: true,
          borrower_id: true,
          borrower: { select: { section_id: true } },
          borrowStatus: { select: { code: true, name: true } },
        },
      });

      if (!transaction) {
        throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
      }

      if (transaction.borrow_status_id !== borrowedTxStatusId) {
        const currentStatusCode = transaction.borrowStatus?.code || transaction.borrow_status_id;
        throw new BadRequestException(
          `Cannot request return: transaction is currently in '${currentStatusCode}' status (expected BORROWED).`
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
        throw new BadRequestException(
          'You do not have permission to request return for this transaction (must be the borrower or belong to the same department)'
        );
      }

      let combinedRemark = dto.remark || null;
      if (dto.pickupLocation) {
        combinedRemark = combinedRemark
          ? `จุดรับ: ${dto.pickupLocation} | ${combinedRemark}`
          : `จุดรับ: ${dto.pickupLocation}`;
      }

      // 1. Optimistic lock on BorrowTransaction update
      const txUpdate = await tx.borrowTransaction.updateMany({
        where: { id, borrow_status_id: borrowedTxStatusId },
        data: {
          borrow_status_id: pendingReturnTxStatusId,
          return_method: ReturnMethod.staff_pickup,
          returned_by_user_id: user.id,
          return_date: new Date(),
          return_remark: combinedRemark,
        },
      });

      if (txUpdate.count === 0) {
        throw new ConflictException(`Transaction with ID ${id} has already been processed or status changed`);
      }

      // 2. Lock Asset availability to UNAVAILABLE
      const assetUpdate = await tx.asset.updateMany({
        where: { id: transaction.asset_id, availability_status_id: borrowedAvailabilityId },
        data: { availability_status_id: unavailableAvailabilityId },
      });

      if (assetUpdate.count === 0) {
        throw new ConflictException(
          `Failed to lock asset availability for asset ${transaction.asset_id}: asset is not in BORROWED status`
        );
      }

      return tx.borrowTransaction.findUnique({ where: { id } });
    });
  }

  async claimPickup(id: string, user: any) {
    const pendingReturnTxStatusId = await this.getStatusId('borrowStatus', 'PENDING_RETURN');
    const inPickupTxStatusId = await this.getStatusId('borrowStatus', 'IN_PICKUP');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.borrowTransaction.findUnique({
        where: { id },
        select: {
          id: true,
          asset_id: true,
          borrow_status_id: true,
          borrowStatus: { select: { code: true, name: true } },
        },
      });

      if (!transaction) {
        throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
      }

      if (transaction.borrow_status_id !== pendingReturnTxStatusId) {
        const currentStatusCode = transaction.borrowStatus?.code || transaction.borrow_status_id;
        throw new BadRequestException(
          `Cannot claim pickup: transaction is currently in '${currentStatusCode}' status (expected PENDING_RETURN).`
        );
      }

      // Optimistic lock on BorrowTransaction update
      const txUpdate = await tx.borrowTransaction.updateMany({
        where: { id, borrow_status_id: pendingReturnTxStatusId },
        data: {
          borrow_status_id: inPickupTxStatusId,
          received_by_user_id: user.id,
        },
      });

      if (txUpdate.count === 0) {
        throw new ConflictException(
          `Transaction with ID ${id} has already been claimed or status changed`
        );
      }

      return tx.borrowTransaction.findUnique({ where: { id } });
    });
  }

  async completeReturn(id: string, dto: CompleteReturnBorrowDto, user: any) {
    const inPickupTxStatusId = await this.getStatusId('borrowStatus', 'IN_PICKUP');
    const pendingReturnTxStatusId = await this.getStatusId('borrowStatus', 'PENDING_RETURN');
    const returnedTxStatusId = await this.getStatusId('borrowStatus', 'RETURNED');
    const unavailableAvailabilityId = await this.getStatusId('availabilityStatus', 'UNAVAILABLE');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.borrowTransaction.findUnique({
        where: { id },
        select: {
          id: true,
          asset_id: true,
          borrow_status_id: true,
          return_remark: true,
          borrowStatus: { select: { code: true, name: true } },
        },
      });

      if (!transaction) {
        throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
      }

      if (
        transaction.borrow_status_id !== inPickupTxStatusId &&
        transaction.borrow_status_id !== pendingReturnTxStatusId
      ) {
        const currentStatusCode = transaction.borrowStatus?.code || transaction.borrow_status_id;
        throw new BadRequestException(
          `Cannot complete return: transaction is currently in '${currentStatusCode}' status (expected IN_PICKUP or PENDING_RETURN).`
        );
      }

      let updatedRemark = transaction.return_remark;
      if (dto.returnRemark) {
        updatedRemark = updatedRemark
          ? `${updatedRemark} | ตรวจรับ: ${dto.returnRemark}`
          : `ตรวจรับ: ${dto.returnRemark}`;
      }

      // 1. Optimistic lock on BorrowTransaction update
      const txUpdate = await tx.borrowTransaction.updateMany({
        where: {
          id,
          borrow_status_id: transaction.borrow_status_id,
        },
        data: {
          borrow_status_id: returnedTxStatusId,
          received_by_user_id: user.id,
          return_condition: dto.returnCondition,
          return_remark: updatedRemark,
        },
      });

      if (txUpdate.count === 0) {
        throw new ConflictException(`Transaction with ID ${id} has already been processed or status changed`);
      }

      // 2. Update Asset Availability and Status
      if (dto.returnCondition === ReturnCondition.Normal) {
        const availableStatusId = await this.getStatusId('availabilityStatus', 'AVAILABLE');
        const normalAssetStatusId = await this.getStatusId('assetStatus', 'NORMAL');

        const assetUpdate = await tx.asset.updateMany({
          where: { id: transaction.asset_id },
          data: {
            availability_status_id: availableStatusId,
            asset_status_id: normalAssetStatusId,
          },
        });

        if (assetUpdate.count === 0) {
          throw new ConflictException(
            `Failed to update asset availability for asset ${transaction.asset_id}`
          );
        }
      } else if (dto.returnCondition === ReturnCondition.Damage) {
        const damagedStatusId = await this.getStatusId('assetStatus', 'DAMAGED');

        const assetUpdate = await tx.asset.updateMany({
          where: { id: transaction.asset_id },
          data: {
            availability_status_id: unavailableAvailabilityId,
            asset_status_id: damagedStatusId,
          },
        });

        if (assetUpdate.count === 0) {
          throw new ConflictException(
            `Failed to update asset availability and status for asset ${transaction.asset_id}`
          );
        }
      }

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
            select: { section_id: true },
          },
          borrowStatus: {
            select: { code: true, name: true },
          },
        },
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

      if (!isStaffOverride) {
        throw new BadRequestException(
          'Desk return can only be performed by Asset Center Staff or Admins'
        );
      }

      // Validate returnedByUserId
      if (!dto.returnedByUserId) {
        throw new BadRequestException('Returned by user ID or Employee Code is required for desk return');
      }

      const retUser = await tx.user.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { id: dto.returnedByUserId },
            { employeeId: dto.returnedByUserId },
          ],
        },
        select: { id: true, section_id: true },
      });

      if (!retUser) {
        throw new NotFoundException(`Returned by user not found with ID or Employee Code: ${dto.returnedByUserId}`);
      }

      const isOwner = retUser.id === transaction.borrower_id;
      const isSameDept =
        retUser.section_id &&
        transaction.borrower?.section_id &&
        retUser.section_id === transaction.borrower.section_id;

      if (!isOwner && !isSameDept) {
        throw new BadRequestException(
          'The person returning the asset must be the borrower or belong to the same department as the borrower'
        );
      }

      // Optimistic lock on BorrowTransaction update
      const txUpdate = await tx.borrowTransaction.updateMany({
        where: { id, borrow_status_id: borrowedTxStatusId },
        data: {
          borrow_status_id: returnedTxStatusId,
          return_date: new Date(),
          return_condition: dto.returnCondition,
          return_method: ReturnMethod.self_return,
          return_remark: dto.returnRemark || null,
          returned_by_user_id: retUser.id,
          received_by_user_id: user.id,
        },
      });

      if (txUpdate.count === 0) {
        throw new ConflictException(`Transaction with ID ${id} has already been processed or status changed`);
      }

      // Update Asset Availability and Status
      if (dto.returnCondition === ReturnCondition.Normal) {
        const availableStatusId = await this.getStatusId('availabilityStatus', 'AVAILABLE');
        const assetUpdate = await tx.asset.updateMany({
          where: { id: transaction.asset_id, availability_status_id: borrowedAvailabilityId },
          data: { availability_status_id: availableStatusId },
        });

        if (assetUpdate.count === 0) {
          throw new ConflictException(
            `Failed to update asset availability for asset ${transaction.asset_id}: asset is not in BORROWED status`
          );
        }
      } else if (dto.returnCondition === ReturnCondition.Damage) {
        const unavailableStatusId = await this.getStatusId('availabilityStatus', 'UNAVAILABLE');
        const damagedStatusId = await this.getStatusId('assetStatus', 'DAMAGED');

        const assetUpdate = await tx.asset.updateMany({
          where: { id: transaction.asset_id, availability_status_id: borrowedAvailabilityId },
          data: {
            availability_status_id: unavailableStatusId,
            asset_status_id: damagedStatusId,
          },
        });

        if (assetUpdate.count === 0) {
          throw new ConflictException(
            `Failed to update asset availability and status for asset ${transaction.asset_id}: asset is not in BORROWED status`
          );
        }
      }

      return tx.borrowTransaction.findUnique({ where: { id } });
    });
  }

  async cancelBorrow(id: string, dto: CancelBorrowDto, user: any) {
    const pendingTxStatusId = await this.getStatusId('borrowStatus', 'PENDING_APPROVE');
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

      // Business Rule: Department Staff / Borrower can only cancel PENDING_APPROVE transactions
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
          `Only pending (PENDING_APPROVE) or approved (APPROVED) transactions can be cancelled. Current status is '${currentStatusCode}'.`
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
          cancelled_by_user_id: user.id,
          cancel_reason: dto?.cancelReason || null,
        }
      });

      if (txUpdate.count === 0) {
        throw new ConflictException(`Transaction with ID ${id} has already been processed or status changed`);
      }

      // Optimistic lock on Asset update: return RESERVED -> AVAILABLE
      const assetUpdate = await tx.asset.updateMany({
        where: {
          id: transaction.asset_id,
          availability_status_id: reservedAvailabilityId,
        },
        data: { availability_status_id: availableStatusId }
      });

      if (assetUpdate.count === 0) {
        throw new ConflictException(
          `Failed to restore asset availability for asset ${transaction.asset_id}: asset is not in RESERVED status`
        );
      }

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
    } else {
      if (query.sectionId) {
        where.borrower = { ...(where.borrower || {}), section_id: query.sectionId };
      }
      if (query.borrowerId) {
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
    }

    if (query.borrowStatusId) where.borrow_status_id = query.borrowStatusId;

    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(`${query.startDate}T00:00:00.000Z`) } : {}),
        ...(query.endDate ? { lte: new Date(`${query.endDate}T23:59:59.999Z`) } : {}),
      };
    }

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
        createdByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
        approvedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
        handoverByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
        returnedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
        receivedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
        rejectedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
        cancelledByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
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
