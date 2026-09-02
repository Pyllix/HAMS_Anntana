import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { paginate } from 'src/common/utils/paginate.util';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateSparepartDto } from './dto/create-spare-part.dto';
import { UpdateSparepartDto } from './dto/update-spare-part.dto';
import { QuerySparepartDto } from './dto/query-spare-part.dto';
import { StockInSparepartDto } from './dto/stock-in-spare-part.dto';
import { QuerySparepartTxnDto } from './dto/query-spare-part-txn.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SparePartsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Sparepart Methods
  // ───────────────────────────────────────────────────────────────────────────

  async create(dto: CreateSparepartDto, userId: string) {
    // Validate group exists
    const group = await this.prisma.sparepartGroup.findFirst({
      where: { id: dto.groupId, deletedAt: null },
    });
    if (!group) {
      throw new NotFoundException(`Spare part group #${dto.groupId} not found`);
    }

    // Check unique code
    const existing = await this.prisma.sparepart.findFirst({
      where: { code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Spare part code "${dto.code}" already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const initialStock = dto.qtyInStock ?? 0;
      const sparepart = await tx.sparepart.create({
        data: {
          code: dto.code,
          name: dto.name,
          unit: dto.unit ?? 'ชิ้น',
          price: dto.price,
          minStock: dto.minStock ?? 0,
          qtyInStock: initialStock,
          groupId: dto.groupId,
        },
        include: { group: true },
      });

      // If initial stock > 0, log in SparepartAdd
      if (initialStock > 0) {
        await tx.sparepartAdd.create({
          data: {
            sparepartId: sparepart.id,
            qty: initialStock,
            totalPrice: Number(dto.price) * initialStock,
            sparepartAddDoc: 'INITIAL_STOCK',
            addBy: userId,
          },
        });
      }

      return sparepart;
    });
  }

  async findAll(query: QuerySparepartDto) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const search = query.search?.trim();

    const where: Prisma.SparepartWhereInput = {
      deletedAt: null,
      ...(query.groupId ? { groupId: Number(query.groupId) } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (query.lowStock) {
      const lowStockIds = await this.prisma.$queryRaw<{ sparepart_id: number }[]>`
        SELECT sparepart_id FROM spareparts
        WHERE deleted_at IS NULL
          AND qty_in_stock <= min_stock
          ${query.groupId ? Prisma.sql`AND group_id = ${Number(query.groupId)}` : Prisma.empty}
          ${search ? Prisma.sql`AND (sparepart_code ILIKE ${`%${search}%`} OR name ILIKE ${`%${search}%`})` : Prisma.empty}
      `;

      const ids = lowStockIds.map((item) => item.sparepart_id);
      where.id = { in: ids };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.sparepart.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
        include: {
          group: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.sparepart.count({ where }),
    ]);

    const formatted = items.map((item) => ({
      ...item,
      isLowStock: item.qtyInStock <= item.minStock,
    }));

    return paginate(formatted, total, page, limit);
  }

  async findLowStockSummary() {
    const lowStockParts = await this.prisma.sparepart.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        group: { select: { id: true, name: true } },
      },
      orderBy: { qtyInStock: 'asc' },
    });

    const filtered = lowStockParts
      .filter((p) => p.qtyInStock <= p.minStock)
      .map((p) => ({
        ...p,
        isLowStock: true,
        deficit: p.minStock - p.qtyInStock,
      }));

    return {
      totalLowStockCount: filtered.length,
      items: filtered,
    };
  }

  async findOne(id: number) {
    const item = await this.prisma.sparepart.findFirst({
      where: { id, deletedAt: null },
      include: {
        group: true,
        _count: {
          select: {
            sparepartAdds: { where: { deletedAt: null } },
            sparepartTxns: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Spare part #${id} not found`);
    }

    return {
      ...item,
      isLowStock: item.qtyInStock <= item.minStock,
    };
  }

  async update(id: number, dto: UpdateSparepartDto) {
    await this.findOne(id);

    if (dto.groupId) {
      const group = await this.prisma.sparepartGroup.findFirst({
        where: { id: dto.groupId, deletedAt: null },
      });
      if (!group) {
        throw new NotFoundException(`Spare part group #${dto.groupId} not found`);
      }
    }

    if (dto.code) {
      const existing = await this.prisma.sparepart.findFirst({
        where: { code: dto.code, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`Spare part code "${dto.code}" already exists`);
      }
    }

    const updated = await this.prisma.sparepart.update({
      where: { id },
      data: dto,
      include: { group: true },
    });

    return {
      ...updated,
      isLowStock: updated.qtyInStock <= updated.minStock,
    };
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.sparepart.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Stock-in (SparepartAdd)
  // ───────────────────────────────────────────────────────────────────────────

  async stockIn(dto: StockInSparepartDto, userId: string) {
    const sparepart = await this.findOne(dto.sparepartId);

    const calculatedTotal =
      dto.totalPrice !== undefined
        ? dto.totalPrice
        : Number(sparepart.price) * dto.qty;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create SparepartAdd entry
      const stockInRecord = await tx.sparepartAdd.create({
        data: {
          sparepartId: dto.sparepartId,
          qty: dto.qty,
          totalPrice: calculatedTotal,
          sparepartAddDoc: dto.sparepartAddDoc,
          addBy: userId,
        },
        include: {
          sparepart: true,
          user: {
            select: { id: true, firstname: true, lastname: true, email: true },
          },
        },
      });

      // 2. Increment stock on Sparepart
      const updatedSparepart = await tx.sparepart.update({
        where: { id: dto.sparepartId },
        data: {
          qtyInStock: { increment: dto.qty },
        },
        include: { group: true },
      });

      return {
        stockInRecord,
        updatedSparepart: {
          ...updatedSparepart,
          isLowStock: updatedSparepart.qtyInStock <= updatedSparepart.minStock,
        },
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Transactions & History
  // ───────────────────────────────────────────────────────────────────────────

  async findSparepartHistory(sparepartId: number, query: PaginationDto) {
    await this.findOne(sparepartId);

    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;

    const [adds, txns] = await Promise.all([
      this.prisma.sparepartAdd.findMany({
        where: { sparepartId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstname: true, lastname: true, email: true },
          },
        },
      }),
      this.prisma.sparepartTxn.findMany({
        where: { sparepartId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstname: true, lastname: true, email: true },
          },
        },
      }),
    ]);

    type TimelineItem = {
      id: string;
      activityType: 'STOCK_IN' | 'TXN';
      type: string;
      qty: number;
      amount: number;
      docOrJob: string | null;
      actor: { id: string; name: string; email: string };
      timestamp: Date;
    };

    const combined: TimelineItem[] = [
      ...adds.map((a) => ({
        id: `ADD-${a.id}`,
        activityType: 'STOCK_IN' as const,
        type: 'RESTOCK',
        qty: a.qty,
        amount: Number(a.totalPrice),
        docOrJob: a.sparepartAddDoc,
        actor: {
          id: a.user.id,
          name: `${a.user.firstname} ${a.user.lastname}`.trim(),
          email: a.user.email,
        },
        timestamp: a.createdAt,
      })),
      ...txns.map((t) => ({
        id: `TXN-${t.id}`,
        activityType: 'TXN' as const,
        type: t.txnType,
        qty: t.qty,
        amount: Number(t.unitPrice) * t.qty,
        docOrJob: t.jobId,
        actor: {
          id: t.user.id,
          name: `${t.user.firstname} ${t.user.lastname}`.trim(),
          email: t.user.email,
        },
        timestamp: t.createdAt,
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = combined.length;
    const paginatedItems = combined.slice((page - 1) * limit, page * limit);

    return paginate(paginatedItems, total, page, limit);
  }

  async findAllTransactions(query: QuerySparepartTxnDto) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;

    const where: Prisma.SparepartTxnWhereInput = {
      ...(query.sparepartId ? { sparepartId: Number(query.sparepartId) } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.txnType ? { txnType: query.txnType } : {}),
      ...(query.userId ? { txnBy: query.userId } : {}),
      ...((query.startDate || query.endDate)
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(`${query.startDate}T00:00:00.000Z`) } : {}),
              ...(query.endDate ? { lte: new Date(`${query.endDate}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [txns, total] = await this.prisma.$transaction([
      this.prisma.sparepartTxn.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sparepart: {
            select: { id: true, code: true, name: true, unit: true },
          },
          user: {
            select: { id: true, firstname: true, lastname: true, email: true },
          },
        },
      }),
      this.prisma.sparepartTxn.count({ where }),
    ]);

    return paginate(txns, total, page, limit);
  }
}
