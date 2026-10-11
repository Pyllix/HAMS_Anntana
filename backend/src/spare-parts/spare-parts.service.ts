import {
  BadRequestException,
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
import { QueryStockInHistoryDto } from './dto/query-stock-in-history.dto';
import { Prisma } from '@prisma/client';

type SparepartHistoryRow = {
  total: bigint;
  source: 'ADD' | 'TXN' | null;
  recordId: number | null;
  qty: number | null;
  amountBase: string | null;
  transactionType: string | null;
  docOrJob: string | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  timestamp: Date | null;
};

type StockInHistorySearchRow = {
  total: bigint;
  id: number | null;
  sparepartId: number | null;
  qty: number | null;
  totalPrice: Prisma.Decimal | null;
  sparepartAddDoc: string | null;
  addBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  deletedAt: Date | null;
  partId: number | null;
  partCode: string | null;
  partName: string | null;
  partUnit: string | null;
  userId: string | null;
  userFirstname: string | null;
  userLastname: string | null;
  userEmail: string | null;
};

@Injectable()
export class SparePartsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateNonNegativeValues(dto: UpdateSparepartDto) {
    for (const field of ['price', 'minStock', 'qtyInStock'] as const) {
      const value = dto[field];
      if (value !== undefined && value < 0) {
        throw new BadRequestException(`${field} must not be negative`);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ───────────────────────────────────────────────────────────────────────────

  private async generateSparepartCode(
    groupId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx || this.prisma;
    const groupStr = String(groupId).padStart(2, '0');
    const prefix = `SP${groupStr}-`;

    const latest = await client.sparepart.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let nextSeq = 1;
    if (latest && latest.code) {
      const parts = latest.code.split('-');
      if (parts.length >= 2) {
        const lastSeq = parseInt(parts[1], 10);
        if (!isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Sparepart Methods
  // ───────────────────────────────────────────────────────────────────────────

  async create(dto: CreateSparepartDto, userId: string) {
    this.validateNonNegativeValues(dto);
    // Validate group exists
    const group = await this.prisma.sparepartGroup.findFirst({
      where: { id: dto.groupId, deletedAt: null },
    });
    if (!group) {
      throw new NotFoundException(`Spare part group #${dto.groupId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const code = await this.generateSparepartCode(dto.groupId, tx);
      const initialStock = dto.qtyInStock ?? 0;
      const sparepart = await tx.sparepart.create({
        data: {
          code,
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
      ...(query.lowStock
        ? {
            qtyInStock: {
              lte: this.prisma.sparepart.fields.minStock,
            },
          }
        : {}),
    };

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
        qtyInStock: {
          lte: this.prisma.sparepart.fields.minStock,
        },
      },
      include: {
        group: { select: { id: true, name: true } },
      },
      orderBy: [{ qtyInStock: 'asc' }, { id: 'asc' }],
    });

    const items = lowStockParts.map((part) => ({
      ...part,
      isLowStock: true,
      deficit: part.minStock - part.qtyInStock,
    }));

    return {
      totalLowStockCount: items.length,
      items,
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
    this.validateNonNegativeValues(dto);
    await this.findOne(id);

    if (dto.groupId) {
      const group = await this.prisma.sparepartGroup.findFirst({
        where: { id: dto.groupId, deletedAt: null },
      });
      if (!group) {
        throw new NotFoundException(
          `Spare part group #${dto.groupId} not found`,
        );
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
    const sparepart = await this.prisma.sparepart.findFirst({
      where: { id: sparepartId, deletedAt: null },
      select: { id: true },
    });

    if (!sparepart) {
      throw new NotFoundException(`Spare part #${sparepartId} not found`);
    }

    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const offset = (page - 1) * limit;
    // A global prefix of K items can contain at most K items from either source;
    // fetch that prefix from each source, then apply the requested page once globally.
    const rows = await this.prisma.$queryRaw<SparepartHistoryRow[]>(Prisma.sql`
      WITH metadata AS (
        SELECT
          (SELECT COUNT(*)
           FROM "sparepart_adds"
           WHERE "sparepart_id" = ${sparepartId}
             AND "deleted_at" IS NULL)
          +
          (SELECT COUNT(*)
           FROM "sparepart_txns"
           WHERE "sparepart_id" = ${sparepartId}) AS total
      ),
      timeline AS (
        SELECT
          'ADD'::text AS source,
          0::integer AS source_order,
          latest_stock_ins."sparepart_add_id" AS record_id,
          latest_stock_ins."createdAt" AS created_at
        FROM (
          SELECT "sparepart_add_id", "createdAt"
          FROM "sparepart_adds"
          WHERE "sparepart_id" = ${sparepartId}
            AND "deleted_at" IS NULL
          ORDER BY "createdAt" DESC, "sparepart_add_id" DESC
          LIMIT ${offset + limit}
        ) AS latest_stock_ins

        UNION ALL

        SELECT
          'TXN'::text AS source,
          1::integer AS source_order,
          latest_transactions."txn_id" AS record_id,
          latest_transactions."createdAt" AS created_at
        FROM (
          SELECT "txn_id", "createdAt"
          FROM "sparepart_txns"
          WHERE "sparepart_id" = ${sparepartId}
          ORDER BY "createdAt" DESC, "txn_id" DESC
          LIMIT ${offset + limit}
        ) AS latest_transactions
      ),
      page AS (
        SELECT source, source_order, record_id, created_at
        FROM timeline
        ORDER BY created_at DESC, source_order ASC, record_id DESC
        LIMIT ${limit}
        OFFSET ${offset}
      )
      SELECT
        metadata.total,
        page.source,
        page.record_id AS "recordId",
        CASE WHEN page.source = 'ADD' THEN stock_in.qty ELSE txn.qty END AS qty,
        CASE
          WHEN page.source = 'ADD' THEN stock_in.total_price::text
          ELSE txn.unit_price::text
        END AS "amountBase",
        txn.txn_type AS "transactionType",
        CASE
          WHEN page.source = 'ADD' THEN stock_in.sparepart_add_doc
          ELSE txn.job_id
        END AS "docOrJob",
        CASE
          WHEN page.source = 'ADD' THEN stock_in_actor.id
          ELSE txn_actor.id
        END AS "actorId",
        CASE
          WHEN page.source = 'ADD'
            THEN TRIM(stock_in_actor.first_name || ' ' || stock_in_actor.last_name)
          ELSE TRIM(txn_actor.first_name || ' ' || txn_actor.last_name)
        END AS "actorName",
        CASE
          WHEN page.source = 'ADD' THEN stock_in_actor.email
          ELSE txn_actor.email
        END AS "actorEmail",
        page.created_at AS timestamp
      FROM metadata
      LEFT JOIN page ON TRUE
      LEFT JOIN "sparepart_adds" AS stock_in
        ON page.source = 'ADD'
        AND stock_in.sparepart_add_id = page.record_id
      LEFT JOIN "users" AS stock_in_actor
        ON stock_in_actor.id = stock_in.add_by
      LEFT JOIN "sparepart_txns" AS txn
        ON page.source = 'TXN'
        AND txn.txn_id = page.record_id
      LEFT JOIN "users" AS txn_actor
        ON txn_actor.id = txn.txn_by
      ORDER BY
        page.created_at DESC NULLS LAST,
        page.source_order ASC NULLS LAST,
        page.record_id DESC NULLS LAST
    `);

    const data = rows.flatMap((row) => {
      if (
        row.source === null ||
        row.recordId === null ||
        row.qty === null ||
        row.amountBase === null ||
        row.actorId === null ||
        row.actorName === null ||
        row.actorEmail === null ||
        row.timestamp === null
      ) {
        return [];
      }

      return [
        {
          id: `${row.source === 'ADD' ? 'ADD' : 'TXN'}-${row.recordId}`,
          activityType: row.source === 'ADD' ? 'STOCK_IN' : 'TXN',
          type: row.source === 'ADD' ? 'RESTOCK' : row.transactionType!,
          qty: row.qty,
          amount: Number(row.amountBase) * (row.source === 'TXN' ? row.qty : 1),
          docOrJob: row.docOrJob,
          actor: {
            id: row.actorId,
            name: row.actorName,
            email: row.actorEmail,
          },
          timestamp: row.timestamp,
        },
      ];
    });

    const total = Number(rows[0]?.total ?? 0);
    return paginate(data, total, page, limit);
  }

  async findAllTransactions(query: QuerySparepartTxnDto) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;

    const where: Prisma.SparepartTxnWhereInput = {
      ...(query.sparepartId ? { sparepartId: Number(query.sparepartId) } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.txnType ? { txnType: query.txnType } : {}),
      ...(query.userId ? { txnBy: query.userId } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate
                ? { gte: new Date(`${query.startDate}T00:00:00.000Z`) }
                : {}),
              ...(query.endDate
                ? { lte: new Date(`${query.endDate}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
    };

    const [txns, total] = await this.prisma.$transaction([
      this.prisma.sparepartTxn.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

  // ───────────────────────────────────────────────────────────────────────────
  // Stock-In History
  // ───────────────────────────────────────────────────────────────────────────

  async findStockInHistory(query: QueryStockInHistoryDto) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;

    // The measured short-term case is broad and slower through the UNION plan;
    // keep short patterns on the ordered Prisma query that can stop at the page.
    if (query.search && [...query.search].length >= 3) {
      return this.findStockInHistoryBySearch(query, page, limit);
    }

    const where: Prisma.SparepartAddWhereInput = {
      deletedAt: null,
      ...(query.sparepartId ? { sparepartId: Number(query.sparepartId) } : {}),
      ...(query.addBy ? { addBy: query.addBy } : {}),
      ...(query.sparepartAddDoc
        ? {
            sparepartAddDoc: {
              contains: query.sparepartAddDoc,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate
                ? { gte: new Date(`${query.startDate}T00:00:00.000Z`) }
                : {}),
              ...(query.endDate
                ? { lte: new Date(`${query.endDate}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                sparepartAddDoc: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                sparepart: {
                  code: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                sparepart: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const stockInRowsPromise = this.prisma.sparepartAdd.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        sparepart: {
          select: { id: true, code: true, name: true, unit: true },
        },
        user: {
          select: { id: true, firstname: true, lastname: true, email: true },
        },
      },
    });
    const totalCountPromise = this.prisma.sparepartAdd.count({ where });

    // The list and exact count share one filter but do not depend on each
    // other's result. Run them concurrently; keep relation includes on the
    // page query only so the count remains a lightweight database operation.
    const [adds, total] = await Promise.all([
      stockInRowsPromise,
      totalCountPromise,
    ]);

    return paginate(adds, total, page, limit);
  }

  private async findStockInHistoryBySearch(
    query: QueryStockInHistoryDto,
    page: number,
    limit: number,
  ) {
    const offset = (page - 1) * limit;
    const prefixLimit = offset + limit;
    const searchPattern = `%${query.search}%`;
    const sparepartIdFilter = query.sparepartId
      ? Prisma.sql`AND a."sparepart_id" = ${Number(query.sparepartId)}`
      : Prisma.empty;
    const addByFilter = query.addBy
      ? Prisma.sql`AND a."add_by" = ${query.addBy}`
      : Prisma.empty;
    const documentFilter = query.sparepartAddDoc
      ? Prisma.sql`AND a."sparepart_add_doc" ILIKE ${`%${query.sparepartAddDoc}%`}`
      : Prisma.empty;
    const startDateFilter = query.startDate
      ? Prisma.sql`AND a."createdAt" >= ${new Date(`${query.startDate}T00:00:00.000Z`)}`
      : Prisma.empty;
    const endDateFilter = query.endDate
      ? Prisma.sql`AND a."createdAt" <= ${new Date(`${query.endDate}T23:59:59.999Z`)}`
      : Prisma.empty;
    const commonFilters = Prisma.sql`
      ${sparepartIdFilter}
      ${addByFilter}
      ${documentFilter}
      ${startDateFilter}
      ${endDateFilter}
    `;

    const rows = await this.prisma.$queryRaw<
      StockInHistorySearchRow[]
    >(Prisma.sql`
      WITH matching_rows AS (
        SELECT a."sparepart_add_id" AS id, a."createdAt" AS created_at
        FROM "sparepart_adds" AS a
        WHERE a."deleted_at" IS NULL
          ${commonFilters}
          AND a."sparepart_add_doc" ILIKE ${searchPattern}

        UNION

        SELECT a."sparepart_add_id" AS id, a."createdAt" AS created_at
        FROM "spareparts" AS p
        JOIN "sparepart_adds" AS a
          ON a."sparepart_id" = p."sparepart_id"
        WHERE a."deleted_at" IS NULL
          ${commonFilters}
          AND (
            p."sparepart_code" ILIKE ${searchPattern}
            OR p."name" ILIKE ${searchPattern}
          )
      ),
      total_count AS (
        SELECT COUNT(*) AS total FROM matching_rows
      ),
      page_candidates AS (
        (
          SELECT a."sparepart_add_id" AS id, a."createdAt" AS created_at
          FROM "sparepart_adds" AS a
          WHERE a."deleted_at" IS NULL
            ${commonFilters}
            AND a."sparepart_add_doc" ILIKE ${searchPattern}
          ORDER BY a."createdAt" DESC, a."sparepart_add_id" DESC
          LIMIT ${prefixLimit}
        )

        UNION

        (
          SELECT a."sparepart_add_id" AS id, a."createdAt" AS created_at
          FROM "spareparts" AS p
          JOIN "sparepart_adds" AS a
            ON a."sparepart_id" = p."sparepart_id"
          WHERE a."deleted_at" IS NULL
            ${commonFilters}
            AND (
              p."sparepart_code" ILIKE ${searchPattern}
              OR p."name" ILIKE ${searchPattern}
            )
          ORDER BY a."createdAt" DESC, a."sparepart_add_id" DESC
          LIMIT ${prefixLimit}
        )
      ),
      history_page AS (
        SELECT id, created_at
        FROM page_candidates
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
        OFFSET ${offset}
      )
      SELECT
        total_count.total,
        a."sparepart_add_id" AS id,
        a."sparepart_id" AS "sparepartId",
        a.qty,
        a."total_price" AS "totalPrice",
        a."sparepart_add_doc" AS "sparepartAddDoc",
        a."add_by" AS "addBy",
        a."createdAt",
        a."updatedAt",
        a."deleted_at" AS "deletedAt",
        p."sparepart_id" AS "partId",
        p."sparepart_code" AS "partCode",
        p.name AS "partName",
        p.unit AS "partUnit",
        u.id AS "userId",
        u."first_name" AS "userFirstname",
        u."last_name" AS "userLastname",
        u.email AS "userEmail"
      FROM total_count
      LEFT JOIN history_page AS page ON TRUE
      LEFT JOIN "sparepart_adds" AS a
        ON a."sparepart_add_id" = page.id
      LEFT JOIN "spareparts" AS p
        ON p."sparepart_id" = a."sparepart_id"
      LEFT JOIN "users" AS u
        ON u.id = a."add_by"
      ORDER BY page.created_at DESC NULLS LAST, page.id DESC NULLS LAST
    `);

    const data = rows.flatMap((row) => {
      if (row.id === null) return [];

      return [
        {
          id: row.id,
          sparepartId: row.sparepartId!,
          qty: row.qty!,
          totalPrice: row.totalPrice!,
          sparepartAddDoc: row.sparepartAddDoc!,
          addBy: row.addBy!,
          createdAt: row.createdAt!,
          updatedAt: row.updatedAt!,
          deletedAt: row.deletedAt,
          sparepart: {
            id: row.partId!,
            code: row.partCode!,
            name: row.partName!,
            unit: row.partUnit!,
          },
          user: {
            id: row.userId!,
            firstname: row.userFirstname!,
            lastname: row.userLastname!,
            email: row.userEmail!,
          },
        },
      ];
    });

    const total = Number(rows[0]?.total ?? 0);
    return paginate(data, total, page, limit);
  }
}
