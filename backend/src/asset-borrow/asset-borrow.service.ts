import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAssetBorrowDto } from './dto/create-asset-borrow.dto';
import { ReturnAssetBorrowDto } from './dto/return-asset-borrow.dto';
import { RequestReturnBorrowDto } from './dto/request-return-borrow.dto';
import { CompleteReturnBorrowDto } from './dto/complete-return-borrow.dto';
import { BorrowFilterDto } from './dto/borrow-filter.dto';
import { CancelBorrowDto } from './dto/cancel-borrow.dto';
import { CreateBorrowExtensionDto } from './dto/create-borrow-extension.dto';
import { ReviewBorrowExtensionDto } from './dto/review-borrow-extension.dto';
import { BorrowExtensionFilterDto } from './dto/borrow-extension-filter.dto';
import { QueryBorrowRecommendationsDto } from './dto/query-borrow-recommendations.dto';
import {
  BorrowRecommendationsResponseDto,
  BorrowRecommendationCandidateDto,
  SwapCheckResponseDto,
} from './dto/borrow-recommendation-response.dto';
import { paginate, PaginatedResult } from '../common/utils/paginate.util';
import { ReturnCondition, ReturnMethod, UserRole, RequestSource, BorrowExtensionType, BorrowExtensionStatus, Prisma } from '@prisma/client';

@Injectable()
export class AssetBorrowService {
  constructor(private prisma: PrismaService) { }

  private async generateBorrowNo(tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || this.prisma;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `BR-${year}${month}-`;

    const latest = await client.borrowTransaction.findFirst({
      where: { borrowNo: { startsWith: prefix } },
      orderBy: { borrowNo: 'desc' },
      select: { borrowNo: true },
    });

    let nextSeq = 1;
    if (latest && latest.borrowNo) {
      const parts = latest.borrowNo.split('-');
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

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

    const now = new Date();

    // Validate expectedReturnDate if supplied
    let parsedExpectedReturnDate: Date | null = null;
    if (dto.expectedReturnDate) {
      parsedExpectedReturnDate = new Date(dto.expectedReturnDate);
      if (isNaN(parsedExpectedReturnDate.getTime())) {
        throw new BadRequestException('Invalid expected return date format');
      }
      if (parsedExpectedReturnDate <= now) {
        throw new BadRequestException('Expected return date must be in the future');
      }
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
      const borrowNo = await this.generateBorrowNo(tx);
      const transaction = await tx.borrowTransaction.create({
        data: {
          borrowNo,
          asset_id: dto.assetId,
          borrower_id: borrowerId,
          created_by_user_id: user.id,
          borrow_status_id: targetTxStatusId,
          request_source: requestSource,
          delivery_method: dto.deliveryMethod,
          expectedReturnDate: parsedExpectedReturnDate,
          extensionCount: 0,
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

  private enrichBorrowItem(item: any) {
    if (!item) return item;
    const now = new Date();
    const isBorrowed = item.borrowStatus?.code === 'BORROWED';
    const hasExpectedDate = !!item.expectedReturnDate;
    const isOverdue = isBorrowed && hasExpectedDate && now > new Date(item.expectedReturnDate);

    let remainingDays: number | null = null;
    let overdueDays: number | null = null;

    if (hasExpectedDate) {
      const diffMs = new Date(item.expectedReturnDate).getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        remainingDays = diffDays;
        overdueDays = 0;
      } else {
        remainingDays = 0;
        overdueDays = Math.abs(diffDays);
      }
    }

    const pendingExtension = item.extensions?.find?.((e: any) => e.status === BorrowExtensionStatus.PENDING) || null;

    return {
      ...item,
      isOverdue,
      remainingDays,
      overdueDays,
      hasPendingExtension: !!pendingExtension,
      activePendingExtension: pendingExtension,
    };
  }

  async findAll(query: BorrowFilterDto, user?: any): Promise<PaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.borrowNo) {
      where.borrowNo = { contains: query.borrowNo, mode: 'insensitive' };
    }
    if (query.assetId) where.asset_id = query.assetId;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { borrowNo: { contains: search, mode: 'insensitive' } },
        { asset: { name: { contains: search, mode: 'insensitive' } } },
        { borrower: { employeeId: { contains: search, mode: 'insensitive' } } },
        { borrower: { firstname: { contains: search, mode: 'insensitive' } } },
        { borrower: { lastname: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (user?.role === UserRole.DEPARTMENT_STAFF) {
      const callerSectionId = await this.getCallerSectionId(user);
      // Department staff can view borrowings in their department (or their own)
      if (callerSectionId) {
        where.borrower = { ...(where.borrower || {}), section_id: callerSectionId };
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

    if (query.expectedReturnStartDate || query.expectedReturnEndDate) {
      where.expectedReturnDate = {
        ...(query.expectedReturnStartDate ? { gte: new Date(`${query.expectedReturnStartDate}T00:00:00.000Z`) } : {}),
        ...(query.expectedReturnEndDate ? { lte: new Date(`${query.expectedReturnEndDate}T23:59:59.999Z`) } : {}),
      };
    }

    if (query.minExtensionCount !== undefined && query.minExtensionCount !== null) {
      where.extensionCount = { gte: query.minExtensionCount };
    }

    if (query.hasPendingExtension !== undefined && query.hasPendingExtension !== null) {
      if (query.hasPendingExtension) {
        where.extensions = { some: { status: BorrowExtensionStatus.PENDING } };
      } else {
        where.extensions = { none: { status: BorrowExtensionStatus.PENDING } };
      }
    }

    if (query.isOverdue !== undefined && query.isOverdue !== null) {
      const borrowedTxStatusId = await this.getStatusId('borrowStatus', 'BORROWED');
      where.borrow_status_id = borrowedTxStatusId;
      if (query.isOverdue) {
        where.expectedReturnDate = { lt: new Date() };
      } else {
        where.expectedReturnDate = { gte: new Date() };
      }
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
          borrowStatus: { select: { id: true, code: true, name: true } },
          extensions: {
            orderBy: { roundNumber: 'desc' as const },
            take: 3,
            select: { id: true, status: true, roundNumber: true, requestedReturnDate: true, reason: true }
          }
        }
      }),
      this.prisma.borrowTransaction.count({ where }),
    ]);

    const enrichedData = data.map((item) => this.enrichBorrowItem(item));
    return paginate(enrichedData, total, page, limit);
  }

  async findOne(idOrBorrowNo: string, user?: any) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrBorrowNo);

    const transaction = await this.prisma.borrowTransaction.findUnique({
      where: isUuid ? { id: idOrBorrowNo } : { borrowNo: idOrBorrowNo },
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
        borrowStatus: { select: { id: true, code: true, name: true } },
        extensions: {
          orderBy: { roundNumber: 'asc' as const },
          include: {
            requestedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
            reviewedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
          }
        }
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Borrow transaction with ID or Code '${idOrBorrowNo}' not found`);
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
        throw new NotFoundException(`Borrow transaction with ID ${idOrBorrowNo} not found`);
      }
    }


    return this.enrichBorrowItem(transaction);
  }

  async createExtension(borrowTransactionId: string, dto: CreateBorrowExtensionDto, user: any) {
    const { requestedReturnDate, reason } = dto;
    const newReturnDate = new Date(requestedReturnDate);
    if (isNaN(newReturnDate.getTime())) {
      throw new BadRequestException('Invalid requested return date format');
    }
    if (newReturnDate <= new Date()) {
      throw new BadRequestException('Requested return date must be in the future');
    }

    const isDesk = user.role === UserRole.ASSET_CENTER_STAFF;
    const extensionType = isDesk ? BorrowExtensionType.DESK : BorrowExtensionType.ONLINE;

    const borrowedTxStatusId = await this.getStatusId('borrowStatus', 'BORROWED');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.borrowTransaction.findUnique({
        where: { id: borrowTransactionId },
        include: {
          borrower: { select: { id: true, section_id: true } },
          extensions: {
            where: { status: BorrowExtensionStatus.PENDING },
            select: { id: true },
          },
        },
      });

      if (!transaction) {
        throw new NotFoundException(`Borrow transaction with ID ${borrowTransactionId} not found`);
      }

      if (transaction.borrow_status_id !== borrowedTxStatusId) {
        throw new BadRequestException('Cannot request extension: Transaction must be in BORROWED status');
      }

      if (transaction.extensions.length > 0) {
        throw new ConflictException('There is already a pending extension request for this borrowing');
      }

      // Current return date benchmark
      const currentReturnDate = transaction.expectedReturnDate || transaction.handover_date || transaction.createdAt;
      if (newReturnDate <= currentReturnDate) {
        throw new BadRequestException(
          `Requested return date (${newReturnDate.toISOString()}) must be after current return date (${currentReturnDate.toISOString()})`,
        );
      }

      const nextRoundNumber = (transaction.extensionCount || 0) + 1;

      if (extensionType === BorrowExtensionType.DESK) {
        // Direct desk extension by ASSET_CENTER_STAFF
        const extension = await tx.borrowExtension.create({
          data: {
            borrowTransactionId,
            extensionType: BorrowExtensionType.DESK,
            status: BorrowExtensionStatus.APPROVED,
            roundNumber: nextRoundNumber,
            currentReturnDate,
            requestedReturnDate: newReturnDate,
            reason,
            requestedByUserId: user.id,
            reviewedByUserId: user.id,
            reviewedAt: new Date(),
          },
          include: {
            requestedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
            reviewedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
          },
        });

        await tx.borrowTransaction.update({
          where: { id: borrowTransactionId },
          data: {
            expectedReturnDate: newReturnDate,
            extensionCount: nextRoundNumber,
          },
        });

        return extension;
      } else {
        // Online extension: requester must be borrower or from same section, or staff
        if (user.role === UserRole.DEPARTMENT_STAFF) {
          const callerSectionId = await this.getCallerSectionId(user, tx);
          const isOwner = transaction.borrower_id === user.id;
          const isSameDept =
            callerSectionId &&
            transaction.borrower?.section_id &&
            callerSectionId === transaction.borrower.section_id;

          if (!isOwner && !isSameDept) {
            throw new BadRequestException('You do not have permission to request an extension for this borrowing');
          }
        }

        const extension = await tx.borrowExtension.create({
          data: {
            borrowTransactionId,
            extensionType: BorrowExtensionType.ONLINE,
            status: BorrowExtensionStatus.PENDING,
            roundNumber: nextRoundNumber,
            currentReturnDate,
            requestedReturnDate: newReturnDate,
            reason,
            requestedByUserId: user.id,
          },
          include: {
            requestedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
          },
        });

        return extension;
      }
    });
  }

  async reviewExtension(extensionId: string, dto: ReviewBorrowExtensionDto, user: any) {
    const allowedRoles = [UserRole.ASSET_CENTER_STAFF, UserRole.ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(user.role)) {
      throw new BadRequestException('Only Asset Center Staff, Admin, or Manager can review extension requests');
    }

    return this.prisma.$transaction(async (tx) => {
      const extension = await tx.borrowExtension.findUnique({
        where: { id: extensionId },
        include: { borrowTransaction: true },
      });

      if (!extension) {
        throw new NotFoundException(`Borrow extension with ID ${extensionId} not found`);
      }

      if (extension.status !== BorrowExtensionStatus.PENDING) {
        throw new BadRequestException(
          `Cannot review extension: Current status is '${extension.status}', expected 'PENDING'`,
        );
      }

      const now = new Date();

      if (dto.status === BorrowExtensionStatus.APPROVED) {
        const updatedExtension = await tx.borrowExtension.update({
          where: { id: extensionId },
          data: {
            status: BorrowExtensionStatus.APPROVED,
            reviewedByUserId: user.id,
            reviewedAt: now,
          },
          include: {
            requestedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
            reviewedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
          },
        });

        await tx.borrowTransaction.update({
          where: { id: extension.borrowTransactionId },
          data: {
            expectedReturnDate: extension.requestedReturnDate,
            extensionCount: { increment: 1 },
          },
        });

        return updatedExtension;
      } else {
        if (!dto.rejectReason) {
          throw new BadRequestException('Rejection reason is required when rejecting an extension request');
        }

        const updatedExtension = await tx.borrowExtension.update({
          where: { id: extensionId },
          data: {
            status: BorrowExtensionStatus.REJECTED,
            rejectReason: dto.rejectReason,
            reviewedByUserId: user.id,
            reviewedAt: now,
          },
          include: {
            requestedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
            reviewedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
          },
        });

        return updatedExtension;
      }
    });
  }

  async cancelExtension(extensionId: string, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const extension = await tx.borrowExtension.findUnique({
        where: { id: extensionId },
        include: {
          borrowTransaction: { select: { borrower_id: true } },
        },
      });

      if (!extension) {
        throw new NotFoundException(`Borrow extension with ID ${extensionId} not found`);
      }

      if (extension.status !== BorrowExtensionStatus.PENDING) {
        throw new BadRequestException(
          `Cannot cancel extension: Current status is '${extension.status}', expected 'PENDING'`,
        );
      }

      if (user.role === UserRole.DEPARTMENT_STAFF || user.role === UserRole.PARCEL_STAFF) {
        const isOwner = extension.requestedByUserId === user.id || extension.borrowTransaction?.borrower_id === user.id;
        if (!isOwner) {
          throw new BadRequestException('You do not have permission to cancel this extension request');
        }
      }

      return tx.borrowExtension.update({
        where: { id: extensionId },
        data: { status: BorrowExtensionStatus.CANCELLED },
      });
    });
  }

  async findExtensionsByBorrowId(borrowTransactionId: string, user?: any) {
    await this.findOne(borrowTransactionId, user); // check existence and permission

    return this.prisma.borrowExtension.findMany({
      where: { borrowTransactionId },
      orderBy: { roundNumber: 'asc' },
      include: {
        requestedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
        reviewedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
      },
    });
  }

  async findAllExtensions(query: BorrowExtensionFilterDto, user?: any): Promise<PaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.extensionType) where.extensionType = query.extensionType;
    if (query.borrowTransactionId) where.borrowTransactionId = query.borrowTransactionId;

    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(`${query.startDate}T00:00:00.000Z`) } : {}),
        ...(query.endDate ? { lte: new Date(`${query.endDate}T23:59:59.999Z`) } : {}),
      };
    }

    if (user?.role === UserRole.DEPARTMENT_STAFF) {
      const callerSectionId = await this.getCallerSectionId(user);
      if (callerSectionId) {
        where.borrowTransaction = {
          borrower: { section_id: callerSectionId },
        };
      } else {
        where.requestedByUserId = user.id;
      }
    } else {
      if (query.sectionId) {
        where.borrowTransaction = {
          ...(where.borrowTransaction || {}),
          borrower: { section_id: query.sectionId },
        };
      }
      if (query.borrowerId) {
        const targetUser = await this.prisma.user.findFirst({
          where: {
            deletedAt: null,
            OR: [
              { id: query.borrowerId },
              { employeeId: query.borrowerId },
            ],
          },
        });
        where.borrowTransaction = {
          ...(where.borrowTransaction || {}),
          borrower_id: targetUser ? targetUser.id : query.borrowerId,
        };
      }
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { reason: { contains: search, mode: 'insensitive' } },
        { requestedByUser: { firstname: { contains: search, mode: 'insensitive' } } },
        { requestedByUser: { lastname: { contains: search, mode: 'insensitive' } } },
        { requestedByUser: { employeeId: { contains: search, mode: 'insensitive' } } },
        { borrowTransaction: { borrowNo: { contains: search, mode: 'insensitive' } } },
        { borrowTransaction: { asset: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.borrowExtension.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requestedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
          reviewedByUser: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
          borrowTransaction: {
            select: {
              id: true,
              borrowNo: true,
              expectedReturnDate: true,
              asset: { select: { id: true, name: true, model: true } },
              borrower: { select: { id: true, employeeId: true, firstname: true, lastname: true, section_id: true } },
            },
          },
        },
      }),
      this.prisma.borrowExtension.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  /**
   * Get smart asset borrow recommendations based on Balanced Usage Rotation (90-day window + idle days).
   */
  async getBorrowRecommendations(
    query: QueryBorrowRecommendationsDto,
  ): Promise<BorrowRecommendationsResponseDto> {
    let model = query.model?.trim();
    let equipmentTypeId = query.equipmentTypeId;

    // If assetId is provided, lookup reference asset to auto-derive model and equipmentTypeId
    if (query.assetId && (!model || equipmentTypeId === undefined)) {
      const refAsset = await this.prisma.asset.findUnique({
        where: { id: query.assetId },
        select: { model: true, equipment_type_id: true },
      });
      if (refAsset) {
        if (!model) model = refAsset.model;
        if (equipmentTypeId === undefined && refAsset.equipment_type_id !== null) {
          equipmentTypeId = refAsset.equipment_type_id;
        }
      }
    }

    const limit = Math.min(50, Math.max(1, query.limit ?? 10));

    // Dynamic filtering conditions for candidate assets
    const filterConditions: Prisma.Sql[] = [
      Prisma.sql`ast.status_code = 'NORMAL'`,
      Prisma.sql`avs.status_code = 'AVAILABLE'`,
    ];

    if (model && equipmentTypeId !== undefined) {
      filterConditions.push(
        Prisma.sql`(a.model = ${model} OR a.equipment_type = ${equipmentTypeId})`,
      );
    } else if (model) {
      filterConditions.push(Prisma.sql`a.model = ${model}`);
    } else if (equipmentTypeId !== undefined) {
      filterConditions.push(Prisma.sql`a.equipment_type = ${equipmentTypeId}`);
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(filterConditions, ' AND ')}`;

    // Query candidates with 90-day usage and idle metrics via PostgreSQL CTE (Zero N+1)
    const rawRows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      WITH candidate_assets AS (
        SELECT 
          a.asset_id,
          a.noid,
          a.name,
          a.model,
          a.serial_no,
          a.receive_date,
          a.image_url,
          a.equipment_type AS equipment_type_id,
          s.name AS section_name
        FROM asset a
        JOIN asset_status ast ON ast.asset_status_id = a.asset_status_id
        JOIN availability_status avs ON avs.availability_status_id = a.availability_status_id
        LEFT JOIN sections s ON s.section_id = a.section_id
        ${whereClause}
      ),
      borrow_metrics_90d AS (
        SELECT 
          bt.asset_id,
          COUNT(bt.borrow_transaction_id)::int AS borrow_count_90d,
          MAX(bt.return_date) AS last_return_date,
          COALESCE(SUM(
            GREATEST(0, EXTRACT(EPOCH FROM (
              LEAST(COALESCE(bt.return_date, NOW()), NOW()) - 
              GREATEST(COALESCE(bt.handover_date, bt.created_at), NOW() - INTERVAL '90 days')
            )) / 86400.0)
          ), 0) AS usage_days_90d
        FROM borrow_transaction bt
        JOIN candidate_assets ca ON ca.asset_id = bt.asset_id
        WHERE (bt.return_date >= NOW() - INTERVAL '90 days' 
           OR bt.handover_date >= NOW() - INTERVAL '90 days'
           OR bt.created_at >= NOW() - INTERVAL '90 days')
        GROUP BY bt.asset_id
      )
      SELECT 
        ca.asset_id,
        ca.noid,
        ca.name,
        ca.model,
        ca.serial_no,
        ca.receive_date,
        ca.image_url,
        ca.equipment_type_id,
        ca.section_name,
        COALESCE(bm.usage_days_90d, 0)::float AS usage_days_90d,
        COALESCE(bm.borrow_count_90d, 0)::int AS borrow_count_90d,
        bm.last_return_date,
        GREATEST(0, EXTRACT(EPOCH FROM (
          NOW() - COALESCE(bm.last_return_date, ca.receive_date, NOW())
        )) / 86400.0)::float AS idle_days
      FROM candidate_assets ca
      LEFT JOIN borrow_metrics_90d bm ON bm.asset_id = ca.asset_id
      ORDER BY 
        usage_days_90d ASC,
        idle_days DESC,
        borrow_count_90d ASC,
        ca.noid ASC;
    `);

    const candidates: BorrowRecommendationCandidateDto[] = rawRows.slice(0, limit).map((row, index) => {
      const usageDays = Number(row.usage_days_90d) || 0;
      const idleDays = Number(row.idle_days) || 0;
      const borrowCount = Number(row.borrow_count_90d) || 0;
      const isRecommended = index === 0;

      let recommendationReason = '';
      if (isRecommended) {
        if (usageDays === 0 && borrowCount === 0) {
          recommendationReason = '🌟 แนะนำเครื่องนี้: ครุภัณฑ์ใหม่พร้อมใช้งาน ยังไม่มีประวัติการยืมในรอบ 90 วัน';
        } else {
          recommendationReason = `🌟 แนะนำเครื่องนี้: ผ่านการใช้งานเพียง ${usageDays.toFixed(1)} วันในรอบ 90 วัน และจอดพักมาแล้ว ${Math.floor(idleDays)} วัน เหมาะสำหรับการหมุนเวียนใช้งาน`;
        }
      }

      return {
        assetId: row.asset_id,
        noid: row.noid,
        name: row.name,
        model: row.model,
        serialNo: row.serial_no,
        sectionName: row.section_name,
        imageUrl: row.image_url,
        usageDays90d: Number(usageDays.toFixed(1)),
        idleDays: Number(idleDays.toFixed(1)),
        borrowCount90d: borrowCount,
        isRecommended,
        recommendationReason,
      };
    });

    return {
      model,
      equipmentTypeId,
      totalAvailable: rawRows.length,
      recommendedAssetId: candidates[0]?.assetId || null,
      candidates,
    };
  }

  /**
   * Check if a significantly better alternative asset exists for Smart Swap Nudge.
   */
  async checkSwapRecommendation(assetId: string): Promise<SwapCheckResponseDto> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        status: true,
        availabilityStatus: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset #${assetId} not found`);
    }

    // Get borrow metrics for the selected asset specifically
    const selectedMetricsRows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT 
        COUNT(bt.borrow_transaction_id)::int AS borrow_count_90d,
        MAX(bt.return_date) AS last_return_date,
        COALESCE(SUM(
          GREATEST(0, EXTRACT(EPOCH FROM (
            LEAST(COALESCE(bt.return_date, NOW()), NOW()) - 
            GREATEST(COALESCE(bt.handover_date, bt.created_at), NOW() - INTERVAL '90 days')
          )) / 86400.0)
        ), 0)::float AS usage_days_90d,
        GREATEST(0, EXTRACT(EPOCH FROM (
          NOW() - COALESCE(MAX(bt.return_date), ${asset.receivedDate}, NOW())
        )) / 86400.0)::float AS idle_days
      FROM borrow_transaction bt
      WHERE bt.asset_id = ${assetId}
        AND (bt.return_date >= NOW() - INTERVAL '90 days' 
         OR bt.handover_date >= NOW() - INTERVAL '90 days'
         OR bt.created_at >= NOW() - INTERVAL '90 days');
    `);

    const selectedUsageDays = Number(Number(selectedMetricsRows[0]?.usage_days_90d || 0).toFixed(1));
    const selectedIdleDays = Number(Number(selectedMetricsRows[0]?.idle_days || 0).toFixed(1));

    const selectedAssetSummary = {
      id: asset.id,
      noid: asset.noid,
      usageDays90d: selectedUsageDays,
      idleDays: selectedIdleDays,
    };

    // Query available candidates of the same model or equipment type
    const recommendations = await this.getBorrowRecommendations({
      model: asset.model,
      equipmentTypeId: asset.equipment_type_id ?? undefined,
      limit: 10,
    });

    // Exclude the selected asset itself from alternatives
    const alternatives = recommendations.candidates.filter(
      (candidate) => candidate.assetId !== assetId,
    );

    if (alternatives.length === 0) {
      return {
        selectedAsset: selectedAssetSummary,
        hasBetterAlternative: false,
        recommendedAsset: null,
      };
    }

    const bestAlternative = alternatives[0];
    const daysDiff = Number((selectedUsageDays - bestAlternative.usageDays90d).toFixed(1));
    const idleDiff = bestAlternative.idleDays - selectedIdleDays;

    // Swap Condition:
    // 1) Alternative has >= 3 fewer usage days OR
    // 2) Selected asset has >= 7 usage days AND alternative has rested >= 7 days longer
    const conditionUsage = daysDiff >= 3;
    const conditionRest = selectedUsageDays >= 7 && idleDiff >= 7;

    if (conditionUsage || conditionRest) {
      const nudgeReason = `💡 พบเครื่องรุ่นเดียวกัน (หมายเลข ${bestAlternative.noid || bestAlternative.model}) จอดพักมาแล้ว ${Math.floor(bestAlternative.idleDays)} วัน (ผ่านการใช้งานน้อยกว่าเครื่องนี้ ${Math.max(0, daysDiff)} วัน) คุณต้องการสลับใช้เครื่องที่แนะนำเพื่อกระจายการใช้งานหรือไม่?`;

      return {
        selectedAsset: selectedAssetSummary,
        hasBetterAlternative: true,
        recommendedAsset: {
          id: bestAlternative.assetId,
          noid: bestAlternative.noid,
          name: bestAlternative.name,
          model: bestAlternative.model,
          usageDays90d: bestAlternative.usageDays90d,
          idleDays: bestAlternative.idleDays,
          daysUsageDifference: Math.max(0, daysDiff),
          nudgeReason,
        },
      };
    }

    return {
      selectedAsset: selectedAssetSummary,
      hasBetterAlternative: false,
      recommendedAsset: null,
    };
  }
}

