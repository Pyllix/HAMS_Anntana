import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import {
  QueryAssetViabilityDto,
  ViabilitySortBy,
  ViabilityStatusFilter,
  SortOrder,
} from './dto/query-asset-viability.dto';
import {
  AssetViabilityDetailResponseDto,
  AssetViabilityItemDto,
  AssetViabilityListResponseDto,
  AssetViabilitySummaryDto,
  HistoricalRepairJobDto,
  ViabilityStatus,
} from './dto/asset-viability-response.dto';

export interface ViabilityEvaluationInput {
  price: number;
  receivedDate: Date | null;
  warrantyDate: string | null;
  usefulLifeYears: number;
  cumulativeRepairCost: number;
  totalRepairCount: number;
  recentRepairCount: number;
  now?: Date;
}

export interface ViabilityEvaluationResult {
  viabilityStatus: ViabilityStatus;
  viabilityReason: string;
  ageYears: number;
  usefulLifeYears: number;
  isUsefulLifeExceeded: boolean;
  isWarrantyActive: boolean;
  costRatioPercentage: number | null;
}

@Injectable()
export class AssetViabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Core Rule-based Decision Tree evaluating asset economic viability.
   * Pure function for high testability and deterministic compliance with EQM-WI-040.
   */
  evaluateViability(input: ViabilityEvaluationInput): ViabilityEvaluationResult {
    const now = input.now ?? new Date();

    // 1. Check Active Warranty
    let isWarrantyActive = false;
    if (input.warrantyDate) {
      const parsedWarranty = new Date(input.warrantyDate);
      if (!isNaN(parsedWarranty.getTime()) && parsedWarranty > now) {
        isWarrantyActive = true;
      }
    }

    // 2. Calculate Asset Age in Years
    let ageYears = 0;
    if (input.receivedDate && !isNaN(input.receivedDate.getTime())) {
      if (input.receivedDate <= now) {
        const diffDays = (now.getTime() - input.receivedDate.getTime()) / (1000 * 60 * 60 * 24);
        ageYears = Math.round((diffDays / 365.25) * 10) / 10;
      }
    }

    // 3. Fallback useful life (Default 8 years for medical equipment)
    const usefulLifeYears = input.usefulLifeYears > 0 ? input.usefulLifeYears : 8;
    const isUsefulLifeExceeded = ageYears >= usefulLifeYears;

    // 4. Calculate Cost Ratio Percentage (null if price <= 0)
    let costRatioPercentage: number | null = null;
    if (input.price > 0) {
      costRatioPercentage = Math.round((input.cumulativeRepairCost / input.price) * 1000) / 10;
    }

    // ─── Rule Hierarchy (Precedence Order) ───────────────────────────────────

    // Rule 1: Active Warranty
    if (isWarrantyActive) {
      return {
        viabilityStatus: 'VIABLE',
        viabilityReason: `ครุภัณฑ์ยังอยู่ในระยะรับประกันการใช้งาน (สิ้นสุดวันที่ ${input.warrantyDate})`,
        ageYears,
        usefulLifeYears,
        isUsefulLifeExceeded,
        isWarrantyActive,
        costRatioPercentage,
      };
    }

    // Rule 2: Critical Cumulative Cost Ratio (>= 70%)
    if (input.price > 0 && costRatioPercentage !== null && costRatioPercentage >= 70) {
      const formattedCost = input.cumulativeRepairCost.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return {
        viabilityStatus: 'UNVIABLE',
        viabilityReason: `ค่าซ่อมสะสม (฿${formattedCost}) คิดเป็น ${costRatioPercentage.toFixed(1)}% ของราคาจัดซื้อ ซึ่งเกินเกณฑ์ร้อยละ 70 ตามระเบียบพัสดุ`,
        ageYears,
        usefulLifeYears,
        isUsefulLifeExceeded,
        isWarrantyActive,
        costRatioPercentage,
      };
    }

    // Rule 3: Expired Useful Life AND High Cost (>= 50%) OR Breakdown (>= 3 times) for priced assets
    if (
      input.price > 0 &&
      isUsefulLifeExceeded &&
      ((costRatioPercentage !== null && costRatioPercentage >= 50) ||
        input.totalRepairCount >= 3)
    ) {
      return {
        viabilityStatus: 'UNVIABLE',
        viabilityReason: `ครุภัณฑ์ใช้งานมาแล้ว ${ageYears} ปี (เกินอายุขัยมาตรฐาน ${usefulLifeYears} ปี) และมีค่าซ่อมสะสมเกินร้อยละ 50 หรือส่งซ่อมซ้ำซาก`,
        ageYears,
        usefulLifeYears,
        isUsefulLifeExceeded,
        isWarrantyActive,
        costRatioPercentage,
      };
    }

    // Rule 4: Zero-Price Assets (Donations/Building attachments) with Expired Life & Excessive Breakdown
    if (input.price <= 0 && isUsefulLifeExceeded && input.totalRepairCount >= 3) {
      return {
        viabilityStatus: 'UNVIABLE',
        viabilityReason: `ครุภัณฑ์ไม่มีราคาจัดซื้อ (บริจาค/โอนย้าย) ใช้งานเกินอายุขัยมาตรฐาน (${ageYears} ปี) และมีประวัติส่งซ่อมซ้ำซากเกินเกณฑ์`,
        ageYears,
        usefulLifeYears,
        isUsefulLifeExceeded,
        isWarrantyActive,
        costRatioPercentage,
      };
    }

    // Rule 5: Warning Thresholds (Cost Ratio 50-70%, Expired Life, or Recent Frequency >= 3)
    if (input.price > 0 && costRatioPercentage !== null && costRatioPercentage >= 50) {
      return {
        viabilityStatus: 'WARNING',
        viabilityReason: `ค่าซ่อมสะสมคิดเป็น ${costRatioPercentage.toFixed(1)}% ของราคาจัดซื้อ (เข้าข่ายเฝ้าระวังช่วง 50–70%)`,
        ageYears,
        usefulLifeYears,
        isUsefulLifeExceeded,
        isWarrantyActive,
        costRatioPercentage,
      };
    }

    if (isUsefulLifeExceeded) {
      return {
        viabilityStatus: 'WARNING',
        viabilityReason: `ครุภัณฑ์ใช้งานมาแล้ว ${ageYears} ปี ซึ่งครบอายุขัยมาตรฐาน (${usefulLifeYears} ปี) ควรเฝ้าระวังความคุ้มค่าในการซ่อมครั้งต่อไป`,
        ageYears,
        usefulLifeYears,
        isUsefulLifeExceeded,
        isWarrantyActive,
        costRatioPercentage,
      };
    }

    if (input.recentRepairCount >= 3) {
      return {
        viabilityStatus: 'WARNING',
        viabilityReason: `ส่งซ่อมถี่ผิดปกติ (${input.recentRepairCount} ครั้งในรอบ 12 เดือนล่าสุด)`,
        ageYears,
        usefulLifeYears,
        isUsefulLifeExceeded,
        isWarrantyActive,
        costRatioPercentage,
      };
    }

    // Rule 6: Default Viable
    return {
      viabilityStatus: 'VIABLE',
      viabilityReason: 'ค่าซ่อมสะสมและอายุการใช้งานอยู่ในเกณฑ์คุ้มค่าต่อการซ่อมบำรุง',
      ageYears,
      usefulLifeYears,
      isUsefulLifeExceeded,
      isWarrantyActive,
      costRatioPercentage,
    };
  }

  /**
   * Find paginated assets with economic viability assessment and summary KPI counters.
   */
  async findAll(query: QueryAssetViabilityDto): Promise<AssetViabilityListResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const sectionId = query.sectionId;
    const assetTypeId = query.assetTypeId;
    const search = query.search?.trim();

    // 1. Build dynamic filters for PostgreSQL CTE
    const whereConditions: Prisma.Sql[] = [];

    if (!query.includeDisposed) {
      whereConditions.push(Prisma.sql`ast.status_code NOT IN ('DISPOSAL', 'LOST')`);
    }

    if (sectionId) {
      whereConditions.push(Prisma.sql`a.section_id = ${sectionId}`);
    }

    if (assetTypeId !== undefined && !isNaN(assetTypeId)) {
      whereConditions.push(Prisma.sql`a.type_id = ${assetTypeId}`);
    }

    if (search) {
      const pattern = `%${search}%`;
      whereConditions.push(
        Prisma.sql`(a.name ILIKE ${pattern} OR a.model ILIKE ${pattern} OR a.serial_no ILIKE ${pattern} OR a.noid ILIKE ${pattern})`,
      );
    }

    const whereClause =
      whereConditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`
        : Prisma.empty;

    // 2. Query aggregate metrics per asset using PostgreSQL CTE (Zero N+1)
    const rawRows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      WITH repair_cost_per_job AS (
        SELECT 
          rj.job_id,
          rj.asset_id,
          rj.repair_cost,
          rj.created_at,
          COALESCE(SUM(
            CASE 
              WHEN st.txn_type = 'WITHDRAW' THEN st.qty * st.unit_price
              WHEN st.txn_type = 'RETURN' THEN - (st.qty * st.unit_price)
              ELSE 0 
            END
          ), 0) AS parts_cost
        FROM repair_job rj
        LEFT JOIN sparepart_txns st ON st.job_id = rj.job_id
        GROUP BY rj.job_id, rj.asset_id, rj.repair_cost, rj.created_at
      ),
      asset_repair_summary AS (
        SELECT 
          asset_id,
          COUNT(job_id) AS total_repair_count,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 year' THEN 1 END) AS recent_repair_count,
          COALESCE(SUM(COALESCE(repair_cost, 0) + parts_cost), 0) AS cumulative_repair_cost
        FROM repair_cost_per_job
        GROUP BY asset_id
      )
      SELECT 
        a.asset_id,
        a.noid,
        a.name,
        a.model,
        a.serial_no,
        a.price,
        a.receive_date,
        a.warranty_date,
        a.created_at,
        t.asset_type_id AS asset_type_id,
        t.name AS asset_type_name,
        COALESCE(t.useful_life, 8) AS useful_life_years,
        s.section_id AS section_id,
        s.name AS section_name,
        ast.asset_status_id AS asset_status_id,
        ast.status_code AS asset_status_code,
        ast.status_name AS asset_status_name,
        COALESCE(ars.total_repair_count, 0)::int AS total_repair_count,
        COALESCE(ars.recent_repair_count, 0)::int AS recent_repair_count,
        COALESCE(ars.cumulative_repair_cost, 0)::numeric AS cumulative_repair_cost
      FROM asset a
      LEFT JOIN asset_repair_summary ars ON ars.asset_id = a.asset_id
      LEFT JOIN asset_type t ON t.asset_type_id = a.type_id
      LEFT JOIN sections s ON s.section_id = a.section_id
      LEFT JOIN asset_status ast ON ast.asset_status_id = a.asset_status_id
      ${whereClause};
    `);

    // 3. Evaluate each asset through the Decision Tree and collect metrics
    const evaluatedItems: AssetViabilityItemDto[] = rawRows.map((row) => {
      const price = Number(row.price) || 0;
      const cumulativeRepairCost = Number(row.cumulative_repair_cost) || 0;
      const totalRepairCount = Number(row.total_repair_count) || 0;
      const recentRepairCount = Number(row.recent_repair_count) || 0;
      const usefulLifeYears = Number(row.useful_life_years) || 8;
      const receivedDate = row.receive_date ? new Date(row.receive_date) : null;
      const warrantyDate = row.warranty_date || null;

      const evalResult = this.evaluateViability({
        price,
        receivedDate,
        warrantyDate,
        usefulLifeYears,
        cumulativeRepairCost,
        totalRepairCount,
        recentRepairCount,
      });

      return {
        id: row.asset_id,
        noid: row.noid,
        name: row.name,
        model: row.model,
        serialNo: row.serial_no,
        price,
        receivedDate: receivedDate ? receivedDate.toISOString() : new Date(row.created_at).toISOString(),
        warrantyDate,
        isWarrantyActive: evalResult.isWarrantyActive,
        assetType: {
          id: row.asset_type_id,
          name: row.asset_type_name || 'ไม่ระบุประเภท',
          usefulLife: usefulLifeYears,
        },
        section: {
          id: row.section_id,
          name: row.section_name || 'ไม่ระบุแผนก',
        },
        assetStatus: {
          id: row.asset_status_id,
          code: row.asset_status_code,
          name: row.asset_status_name,
        },
        metrics: {
          ageYears: evalResult.ageYears,
          usefulLifeYears: evalResult.usefulLifeYears,
          isUsefulLifeExceeded: evalResult.isUsefulLifeExceeded,
          cumulativeRepairCost,
          costRatioPercentage: evalResult.costRatioPercentage,
          totalRepairCount,
          recentRepairCount,
        },
        viabilityStatus: evalResult.viabilityStatus,
        viabilityReason: evalResult.viabilityReason,
      };
    });

    // 4. Calculate Summary KPI Counters (Across all evaluated assets matching initial query)
    const summary: AssetViabilitySummaryDto = {
      totalEvaluated: evaluatedItems.length,
      viableCount: evaluatedItems.filter((i) => i.viabilityStatus === 'VIABLE').length,
      warningCount: evaluatedItems.filter((i) => i.viabilityStatus === 'WARNING').length,
      unviableCount: evaluatedItems.filter((i) => i.viabilityStatus === 'UNVIABLE').length,
      totalCumulativeRepairCost: evaluatedItems.reduce((acc, i) => acc + i.metrics.cumulativeRepairCost, 0),
    };

    // 5. Filter by viabilityStatus if requested
    let filteredItems = evaluatedItems;
    if (query.viabilityStatus && query.viabilityStatus !== ViabilityStatusFilter.ALL) {
      filteredItems = evaluatedItems.filter((i) => i.viabilityStatus === query.viabilityStatus);
    }

    // 6. Sort items
    const sortBy = query.sortBy ?? ViabilitySortBy.COST_RATIO;
    const sortOrder = query.sortOrder ?? SortOrder.DESC;
    const multiplier = sortOrder === SortOrder.DESC ? -1 : 1;

    filteredItems.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case ViabilitySortBy.COST_RATIO:
          comparison = (a.metrics.costRatioPercentage ?? -1) - (b.metrics.costRatioPercentage ?? -1);
          break;
        case ViabilitySortBy.CUMULATIVE_COST:
          comparison = a.metrics.cumulativeRepairCost - b.metrics.cumulativeRepairCost;
          break;
        case ViabilitySortBy.REPAIR_COUNT:
          comparison = a.metrics.totalRepairCount - b.metrics.totalRepairCount;
          break;
        case ViabilitySortBy.AGE:
          comparison = a.metrics.ageYears - b.metrics.ageYears;
          break;
        case ViabilitySortBy.CREATED_AT:
        default:
          comparison = new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime();
          break;
      }
      return comparison * multiplier;
    });

    // 7. Paginate
    const total = filteredItems.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedItems = filteredItems.slice(startIndex, startIndex + limit);

    return {
      summary,
      items: paginatedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Find single asset deep-dive viability assessment, historical repair breakdown,
   * and pre-filled disposal handshake recommendation.
   */
  async findOne(id: string): Promise<AssetViabilityDetailResponseDto> {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        type: true,
        section: true,
        status: true,
        availabilityStatus: true,
        company: true,
        owner: {
          select: { id: true, firstname: true, lastname: true, employeeId: true },
        },
        repairJobs: {
          orderBy: { createdAt: 'desc' },
          include: {
            jobType: true,
            jobStatus: true,
            sparepartTxns: {
              include: { sparepart: true },
            },
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset #${id} not found`);
    }

    const price = Number(asset.price) || 0;
    const receivedDate = asset.receivedDate ? new Date(asset.receivedDate) : null;
    const warrantyDate = asset.warrantyDate || null;
    const usefulLifeYears = asset.type?.useful_life && asset.type.useful_life > 0 ? asset.type.useful_life : 8;

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    let totalOutsourceCost = 0;
    let totalSparePartsCost = 0;
    let recentRepairCount = 0;

    const repairHistory: HistoricalRepairJobDto[] = asset.repairJobs.map((job) => {
      const outsourceCost = job.repairCost ? Number(job.repairCost) : 0;
      totalOutsourceCost += outsourceCost;

      let jobSparePartsCost = 0;
      const spareParts = job.sparepartTxns.map((t) => {
        const unitPrice = Number(t.unitPrice) || 0;
        const lineTotal = unitPrice * t.qty;
        if (t.txnType === 'WITHDRAW') {
          jobSparePartsCost += lineTotal;
        } else if (t.txnType === 'RETURN') {
          jobSparePartsCost -= lineTotal;
        }
        return {
          code: t.sparepart?.code || 'N/A',
          name: t.sparepart?.name || 'Unknown Part',
          qty: t.qty,
          unitPrice,
          totalPrice: lineTotal,
          txnType: t.txnType,
        };
      });

      const netJobSparePartsCost = Math.max(0, jobSparePartsCost);
      totalSparePartsCost += netJobSparePartsCost;

      const createdAt = new Date(job.createdAt);
      if (createdAt >= oneYearAgo) {
        recentRepairCount++;
      }

      return {
        jobId: job.id,
        jobNo: job.jobNo,
        reportType: job.reportType,
        actionType: job.actionType,
        createdAt: createdAt.toISOString(),
        symptom: job.symptom,
        solution: job.solution,
        outsourceCost,
        sparePartsCost: netJobSparePartsCost,
        totalCost: outsourceCost + netJobSparePartsCost,
        spareParts,
      };
    });

    const cumulativeRepairCost = totalOutsourceCost + totalSparePartsCost;
    const totalRepairCount = asset.repairJobs.length;

    const viabilityResult = this.evaluateViability({
      price,
      receivedDate,
      warrantyDate,
      usefulLifeYears,
      cumulativeRepairCost,
      totalRepairCount,
      recentRepairCount,
    });

    // Determine disposal recommendation & guards
    let recommendedAction: 'PROCEED_REPAIR' | 'CAUTION_REPAIR' | 'RECOMMEND_DISPOSAL' = 'PROCEED_REPAIR';
    let actionLabel = 'ใช้งานและซ่อมบำรุงตามปกติ';

    if (viabilityResult.viabilityStatus === 'UNVIABLE') {
      recommendedAction = 'RECOMMEND_DISPOSAL';
      actionLabel = 'เสนอพิจารณาแทงจำหน่าย';
    } else if (viabilityResult.viabilityStatus === 'WARNING') {
      recommendedAction = 'CAUTION_REPAIR';
      actionLabel = 'เฝ้าระวังความคุ้มค่าในการซ่อมครั้งต่อไป';
    }

    let canInitiateDisposal = true;
    let blockReason: string | null = null;

    if (asset.availabilityStatus?.code === 'BORROWED') {
      canInitiateDisposal = false;
      blockReason = 'ASSET_CURRENTLY_BORROWED';
    } else if (asset.status?.code === 'DISPOSAL') {
      canInitiateDisposal = false;
      blockReason = 'ASSET_ALREADY_DISPOSED';
    }

    const buddhistYear = new Date().getFullYear() + 543;

    return {
      asset: {
        id: asset.id,
        noid: asset.noid,
        name: asset.name,
        model: asset.model,
        serialNo: asset.serialNo,
        price,
        receivedDate: receivedDate ? receivedDate.toISOString() : null,
        warrantyDate,
        imageUrl: asset.imageUrl,
        section: asset.section ? { id: asset.section.id, name: asset.section.name, building: asset.section.building } : null,
        type: asset.type ? { id: asset.type.id, name: asset.type.name, usefulLife: usefulLifeYears } : null,
        status: asset.status ? { id: asset.status.id, code: asset.status.code, name: asset.status.name } : null,
        availabilityStatus: asset.availabilityStatus
          ? { id: asset.availabilityStatus.id, code: asset.availabilityStatus.code, name: asset.availabilityStatus.name }
          : null,
      },
      viability: {
        status: viabilityResult.viabilityStatus,
        reason: viabilityResult.viabilityReason,
        costRatioPercentage: viabilityResult.costRatioPercentage,
        ageYears: viabilityResult.ageYears,
        usefulLifeYears,
        isUsefulLifeExceeded: viabilityResult.isUsefulLifeExceeded,
        isWarrantyActive: viabilityResult.isWarrantyActive,
        totalRepairCount,
        recentRepairCount,
        financials: {
          originalPrice: price,
          cumulativeRepairCost,
          totalOutsourceCost,
          totalSparePartsCost,
        },
      },
      repairHistory,
      disposalRecommendation: {
        recommendedAction,
        actionLabel,
        canInitiateDisposal,
        blockReason,
        prefillData: {
          assetId: asset.id,
          noid: asset.noid,
          name: asset.name,
          price,
          cumulativeRepairCost,
          costRatioPercentage: viabilityResult.costRatioPercentage,
          suggestedDisposalReason: `แทงจำหน่ายเนื่องจากประเมินแล้วซ่อมไม่คุ้มค่า: ${viabilityResult.viabilityReason}`,
          suggestedDocPrefix: `DISP-${buddhistYear}-`,
        },
      },
    };
  }
}
