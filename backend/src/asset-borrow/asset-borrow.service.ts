import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAssetBorrowDto } from './dto/create-asset-borrow.dto';
import { ReturnAssetBorrowDto } from './dto/return-asset-borrow.dto';
import { BorrowFilterDto } from './dto/borrow-filter.dto';
import { paginate, PaginatedResult } from '../common/utils/paginate.util';
import { ReturnCondition, UserRole, RequestSource } from '@prisma/client';

@Injectable()
export class AssetBorrowService {
  constructor(private prisma: PrismaService) {}

  private async getStatusId(model: 'availabilityStatus' | 'borrowStatus' | 'assetStatus', code: string): Promise<number> {
    const status = await (this.prisma[model] as any).findUnique({
      where: { code },
    });
    if (!status) {
      throw new Error(`Status code '${code}' not found in ${model}`);
    }
    return status.id;
  }

  async createBorrow(dto: CreateAssetBorrowDto, user: any) {
    // Determine borrower
    const isSelfService = !dto.borrowerId || dto.borrowerId === user.sub;
    const borrowerId = dto.borrowerId || user.sub;

    if (!isSelfService) {
      // Only Asset Center Staff can borrow on behalf of someone else
      if (user.role !== UserRole.ASSET_CENTER_STAFF) {
        throw new BadRequestException('Only Asset Center Staff can create a borrow transaction for another user');
      }
    }

    const availableStatusId = await this.getStatusId('availabilityStatus', 'AVAILABLE');
    const borrowedAvailabilityId = await this.getStatusId('availabilityStatus', 'BORROWED');
    const borrowedTxStatusId = await this.getStatusId('borrowStatus', 'BORROWED');

    return this.prisma.$transaction(async (tx) => {
      // Find asset and ensure it is AVAILABLE
      const asset = await tx.asset.findUnique({
        where: { id: dto.assetId },
        select: { id: true, availability_status_id: true }
      });

      if (!asset) {
        throw new NotFoundException(`Asset with ID ${dto.assetId} not found`);
      }

      if (asset.availability_status_id !== availableStatusId) {
        throw new ConflictException(`Asset with ID ${dto.assetId} is not available for borrowing. Race condition detected or asset already in use.`);
      }

      // Update Asset availability
      await tx.asset.update({
        where: { id: dto.assetId },
        data: { availability_status_id: borrowedAvailabilityId }
      });

      // Create BorrowTransaction
      const transaction = await tx.borrowTransaction.create({
        data: {
          asset_id: dto.assetId,
          borrower_id: borrowerId,
          borrow_status_id: borrowedTxStatusId,
          request_source: dto.requestSource || (isSelfService ? RequestSource.SELF_SERVICE : RequestSource.CENTER_SERVICE),
          delivery_method: dto.deliveryMethod,
        }
      });

      return transaction;
    });
  }

  async returnAsset(id: string, dto: ReturnAssetBorrowDto, user: any) {
    const borrowedTxStatusId = await this.getStatusId('borrowStatus', 'BORROWED');
    const returnedTxStatusId = await this.getStatusId('borrowStatus', 'RETURNED');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.borrowTransaction.findUnique({
        where: { id },
        select: { id: true, asset_id: true, borrow_status_id: true }
      });

      if (!transaction) {
        throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
      }

      if (transaction.borrow_status_id !== borrowedTxStatusId) {
        throw new BadRequestException(`This borrow transaction is not currently active (not BORROWED)`);
      }

      // Update transaction to RETURNED
      const updatedTransaction = await tx.borrowTransaction.update({
        where: { id },
        data: {
          borrow_status_id: returnedTxStatusId,
          return_date: new Date(),
          return_condition: dto.returnCondition,
          return_method: dto.returnMethod,
          return_remark: dto.returnRemark,
          returned_by_user_id: user.sub,
          received_by_user_id: user.sub, // By default, the person processing it (often AC staff) is the receiver
        }
      });

      // Update Asset Availability and Status
      if (dto.returnCondition === ReturnCondition.Normal) {
        const availableStatusId = await this.getStatusId('availabilityStatus', 'AVAILABLE');
        await tx.asset.update({
          where: { id: transaction.asset_id },
          data: { availability_status_id: availableStatusId }
        });
      } else if (dto.returnCondition === ReturnCondition.Damage) {
        const unavailableStatusId = await this.getStatusId('availabilityStatus', 'UNAVAILABLE');
        const damagedStatusId = await this.getStatusId('assetStatus', 'DAMAGED');
        
        await tx.asset.update({
          where: { id: transaction.asset_id },
          data: {
            availability_status_id: unavailableStatusId,
            asset_status_id: damagedStatusId
          }
        });
      }

      return updatedTransaction;
    });
  }

  async findAll(query: BorrowFilterDto): Promise<PaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.assetId) where.asset_id = query.assetId;
    if (query.borrowerId) where.borrower_id = query.borrowerId;
    if (query.borrowStatusId) where.borrow_status_id = query.borrowStatusId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.borrowTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          asset: { select: { id: true, name: true, model: true } },
          borrower: { select: { id: true, firstname: true, lastname: true } },
          borrowStatus: { select: { id: true, code: true, name: true } }
        }
      }),
      this.prisma.borrowTransaction.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const transaction = await this.prisma.borrowTransaction.findUnique({
      where: { id },
      include: {
        asset: { select: { id: true, name: true, model: true } },
        borrower: { select: { id: true, firstname: true, lastname: true } },
        returnedByUser: { select: { id: true, firstname: true, lastname: true } },
        receivedByUser: { select: { id: true, firstname: true, lastname: true } },
        borrowStatus: { select: { id: true, code: true, name: true } }
      }
    });

    if (!transaction) {
      throw new NotFoundException(`Borrow transaction with ID ${id} not found`);
    }

    return transaction;
  }
}
