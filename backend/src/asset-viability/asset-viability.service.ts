import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { thaiCalendarDate } from '../common/time/thai-date';
import {
  QueryAssetViabilityDto,
  ViabilitySortBy,
  SortOrder,
} from './dto/query-asset-viability.dto';
import { RequestDisposalDto } from './dto/request-disposal.dto';
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

interface ViabilityCandidateRow {
  asset_id: string;
  price: Prisma.Decimal | number | string | null;
  receive_date: Date | string | null;
  warranty_date: string | null;
  created_at: Date | string;
  useful_life_years: number | null;
  total_repair_count: number;
  recent_repair_count: number;
  cumulative_repair_cost: Prisma.Decimal | number | string;
}

interface EvaluatedViabilityCandidate {
  row: ViabilityCandidateRow;
  price: number;
  cumulativeRepairCost: number;
  totalRepairCount: number;
  recentRepairCount: number;
  usefulLifeYears: number;
  receivedDate: Date | null;
  evaluation: ViabilityEvaluationResult;
}

@Injectable()
export class AssetViabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Core Rule-based Decision Tree evaluating asset economic viability.
   * Pure function for high testability and deterministic compliance with EQM-WI-040.
   */
  evaluateViability(
    input: ViabilityEvaluationInput,
  ): ViabilityEvaluationResult {
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
        const diffDays =
          (now.getTime() - input.receivedDate.getTime()) /
          (1000 * 60 * 60 * 24);
        ageYears = Math.round((diffDays / 365.25) * 10) / 10;
      }
    }

    // 3. Fallback useful life (Default 8 years for medical equipment)
    const usefulLifeYears =
      input.usefulLifeYears > 0 ? input.usefulLifeYears : 8;
    const isUsefulLifeExceeded = ageYears >= usefulLifeYears;

    // 4. Calculate Cost Ratio Percentage (null if price <= 0)
    let costRatioPercentage: number | null = null;
    if (input.price > 0) {
      costRatioPercentage =
        Math.round((input.cumulativeRepairCost / input.price) * 1000) / 10;
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
    if (
      input.price > 0 &&
      costRatioPercentage !== null &&
      costRatioPercentage >= 70
    ) {
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
    if (
      input.price <= 0 &&
      isUsefulLifeExceeded &&
      input.totalRepairCount >= 3
    ) {
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
    if (
      input.price > 0 &&
      costRatioPercentage !== null &&
      costRatioPercentage >= 50
    ) {
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
      viabilityReason:
        'ค่าซ่อมสะสมและอายุการใช้งานอยู่ในเกณฑ์คุ้มค่าต่อการซ่อมบำรุง',
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
  async findAll(
    query: QueryAssetViabilityDto,
  ): Promise<AssetViabilityListResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const sectionId = query.sectionId;
    const assetTypeId = query.assetTypeId;
    const search = query.search?.trim();

    // 1. Build filters for the candidate set. Repair aggregation must not scan
    // unrelated assets when the list is restricted to a section/type/search.
    const whereConditions: Prisma.Sql[] = [];

    if (!query.includeDisposed) {
      whereConditions.push(
        Prisma.sql`ast.status_code NOT IN ('DISPOSAL', 'LOST')`,
      );
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
    const repairCandidateJoin =
      sectionId || (assetTypeId !== undefined && !isNaN(assetTypeId)) || search
        ? Prisma.sql`JOIN candidate_assets ca ON ca.asset_id = rj.asset_id`
        : Prisma.empty;

    // Keep candidate metrics and page details on one database snapshot. The
    // summary still needs a compact row per candidate, but display-only asset
    // fields are fetched only for the page returned to the client.
    return this.prisma.$transaction(
      async (transaction) => {
        const rows = await transaction.$queryRaw<ViabilityCandidateRow[]>(
          Prisma.sql`
            WITH candidate_assets AS MATERIALIZED (
              SELECT
                a.asset_id,
                a.price,
                a.receive_date,
                a.warranty_date,
                a.created_at,
                COALESCE(t.useful_life, 8) AS useful_life_years
              FROM asset a
              LEFT JOIN asset_type t ON t.asset_type_id = a.type_id
              LEFT JOIN asset_status ast ON ast.asset_status_id = a.asset_status_id
              ${whereClause}
            ),
            repair_cost_per_job AS (
              SELECT
                rj.job_id,
                rj.asset_id,
                rj.repair_cost,
                rj.created_at,
                COALESCE(SUM(
                  CASE
                    WHEN st.txn_type = 'WITHDRAW' THEN st.qty * st.unit_price
                    WHEN st.txn_type = 'RETURN' THEN -(st.qty * st.unit_price)
                    ELSE 0
                  END
                ), 0) AS parts_cost
              FROM repair_job rj
              ${repairCandidateJoin}
              LEFT JOIN sparepart_txns st ON st.job_id = rj.job_id
              GROUP BY rj.job_id, rj.asset_id, rj.repair_cost, rj.created_at
            ),
            asset_repair_summary AS (
              SELECT
                asset_id,
                COUNT(job_id)::int AS total_repair_count,
                COUNT(*) FILTER (
                  WHERE created_at >= NOW() - INTERVAL '1 year'
                )::int AS recent_repair_count,
                COALESCE(
                  SUM(COALESCE(repair_cost, 0) + parts_cost),
                  0
                )::numeric AS cumulative_repair_cost
              FROM repair_cost_per_job
              GROUP BY asset_id
            )
            SELECT
              ca.asset_id,
              ca.price,
              ca.receive_date,
              ca.warranty_date,
              ca.created_at,
              ca.useful_life_years,
              COALESCE(ars.total_repair_count, 0)::int AS total_repair_count,
              COALESCE(ars.recent_repair_count, 0)::int AS recent_repair_count,
              COALESCE(ars.cumulative_repair_cost, 0)::numeric AS cumulative_repair_cost
            FROM candidate_assets ca
            LEFT JOIN asset_repair_summary ars ON ars.asset_id = ca.asset_id;
          `,
        );

        const evaluationNow = new Date();
        const evaluatedCandidates: EvaluatedViabilityCandidate[] = rows.map(
          (row) => {
            const price = Number(row.price) || 0;
            const cumulativeRepairCost =
              Number(row.cumulative_repair_cost) || 0;
            const totalRepairCount = Number(row.total_repair_count) || 0;
            const recentRepairCount = Number(row.recent_repair_count) || 0;
            const usefulLifeYears = Number(row.useful_life_years) || 8;
            const receivedDate = row.receive_date
              ? new Date(row.receive_date)
              : null;
            const evaluation = this.evaluateViability({
              price,
              receivedDate,
              warrantyDate: row.warranty_date || null,
              usefulLifeYears,
              cumulativeRepairCost,
              totalRepairCount,
              recentRepairCount,
              now: evaluationNow,
            });

            return {
              row,
              price,
              cumulativeRepairCost,
              totalRepairCount,
              recentRepairCount,
              usefulLifeYears,
              receivedDate,
              evaluation,
            };
          },
        );

        // Summary uses the original filtered asset scope and is independent of
        // viability-status filtering, sort order, and page selection.
        const summary: AssetViabilitySummaryDto = {
          totalEvaluated: evaluatedCandidates.length,
          viableCount: evaluatedCandidates.filter(
            ({ evaluation }) => evaluation.viabilityStatus === 'VIABLE',
          ).length,
          warningCount: evaluatedCandidates.filter(
            ({ evaluation }) => evaluation.viabilityStatus === 'WARNING',
          ).length,
          unviableCount: evaluatedCandidates.filter(
            ({ evaluation }) => evaluation.viabilityStatus === 'UNVIABLE',
          ).length,
          totalCumulativeRepairCost: evaluatedCandidates.reduce(
            (acc, candidate) => acc + candidate.cumulativeRepairCost,
            0,
          ),
        };

        // Status evaluation remains in the existing pure rule function; only
        // candidates are materialized in application memory for exact results.
        let filteredCandidates = evaluatedCandidates;
        const requestedStatus = query.viabilityStatus?.toString();
        if (requestedStatus && requestedStatus !== 'ALL') {
          filteredCandidates = evaluatedCandidates.filter(
            ({ evaluation }) => evaluation.viabilityStatus === requestedStatus,
          );
        }

        // Sort the compact evaluated set, then hydrate display fields only for
        // the selected page. The ID tie-breaker makes page boundaries stable.
        const sortBy = query.sortBy ?? ViabilitySortBy.COST_RATIO;
        const sortOrder = query.sortOrder ?? SortOrder.DESC;
        const multiplier = sortOrder === SortOrder.DESC ? -1 : 1;
        filteredCandidates.sort((a, b) => {
          let comparison = 0;
          switch (sortBy) {
            case ViabilitySortBy.COST_RATIO:
              comparison =
                (a.evaluation.costRatioPercentage ?? -1) -
                (b.evaluation.costRatioPercentage ?? -1);
              break;
            case ViabilitySortBy.CUMULATIVE_COST:
              comparison = a.cumulativeRepairCost - b.cumulativeRepairCost;
              break;
            case ViabilitySortBy.REPAIR_COUNT:
              comparison = a.totalRepairCount - b.totalRepairCount;
              break;
            case ViabilitySortBy.AGE:
              comparison = a.evaluation.ageYears - b.evaluation.ageYears;
              break;
            case ViabilitySortBy.CREATED_AT:
            default:
              comparison =
                new Date(a.receivedDate ?? a.row.created_at).getTime() -
                new Date(b.receivedDate ?? b.row.created_at).getTime();
              break;
          }
          return comparison === 0
            ? a.row.asset_id.localeCompare(b.row.asset_id)
            : comparison * multiplier;
        });

        const total = filteredCandidates.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const paginatedCandidates = filteredCandidates.slice(
          startIndex,
          startIndex + limit,
        );
        const pageIds = paginatedCandidates.map(({ row }) => row.asset_id);
        const displayAssets = pageIds.length
          ? await transaction.asset.findMany({
              where: { id: { in: pageIds } },
              select: {
                id: true,
                noid: true,
                name: true,
                model: true,
                serialNo: true,
                type: { select: { id: true, name: true } },
                section: { select: { id: true, name: true } },
                status: { select: { id: true, code: true, name: true } },
              },
            })
          : [];
        const displayAssetsById = new Map(
          displayAssets.map((asset) => [asset.id, asset]),
        );

        const items: AssetViabilityItemDto[] = paginatedCandidates.map(
          (candidate) => {
            const asset = displayAssetsById.get(candidate.row.asset_id);
            if (!asset) {
              throw new Error(
                `Asset ${candidate.row.asset_id} disappeared from the viability snapshot`,
              );
            }

            const { evaluation } = candidate;
            const receivedDate = candidate.receivedDate
              ? candidate.receivedDate.toISOString()
              : new Date(candidate.row.created_at).toISOString();
            const warrantyDate = candidate.row.warranty_date || null;

            return {
              id: asset.id,
              noid: asset.noid,
              name: asset.name,
              model: asset.model,
              serialNo: asset.serialNo,
              price: candidate.price,
              receivedDate,
              warrantyDate,
              isWarrantyActive: evaluation.isWarrantyActive,
              assetType: {
                id: asset.type.id,
                name: asset.type.name || 'ไม่ระบุประเภท',
                usefulLife: candidate.usefulLifeYears,
              },
              section: {
                id: asset.section.id,
                name: asset.section.name || 'ไม่ระบุแผนก',
              },
              assetStatus: {
                id: asset.status.id,
                code: asset.status.code,
                name: asset.status.name,
              },
              metrics: {
                ageYears: evaluation.ageYears,
                usefulLifeYears: evaluation.usefulLifeYears,
                isUsefulLifeExceeded: evaluation.isUsefulLifeExceeded,
                cumulativeRepairCost: candidate.cumulativeRepairCost,
                costRatioPercentage: evaluation.costRatioPercentage,
                totalRepairCount: candidate.totalRepairCount,
                recentRepairCount: candidate.recentRepairCount,
              },
              viabilityStatus: evaluation.viabilityStatus,
              viabilityReason: evaluation.viabilityReason,
            };
          },
        );

        return {
          summary,
          items,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
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
          select: {
            id: true,
            firstname: true,
            lastname: true,
            employeeId: true,
          },
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
    const receivedDate = asset.receivedDate
      ? new Date(asset.receivedDate)
      : null;
    const warrantyDate = asset.warrantyDate || null;
    const usefulLifeYears =
      asset.type?.useful_life && asset.type.useful_life > 0
        ? asset.type.useful_life
        : 8;

    const oneYearAgo = new Date();
    oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);

    let totalOutsourceCost = 0;
    let totalSparePartsCost = 0;
    let recentRepairCount = 0;

    const repairHistory: HistoricalRepairJobDto[] = asset.repairJobs.map(
      (job) => {
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
      },
    );

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
    let recommendedAction:
      | 'PROCEED_REPAIR'
      | 'CAUTION_REPAIR'
      | 'RECOMMEND_DISPOSAL' = 'PROCEED_REPAIR';
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

    const buddhistYear = Number(thaiCalendarDate().slice(0, 4)) + 543;

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
        section: asset.section
          ? {
              id: asset.section.id,
              name: asset.section.name,
              building: asset.section.building,
            }
          : null,
        type: asset.type
          ? {
              id: asset.type.id,
              name: asset.type.name,
              usefulLife: usefulLifeYears,
            }
          : null,
        status: asset.status
          ? {
              id: asset.status.id,
              code: asset.status.code,
              name: asset.status.name,
            }
          : null,
        availabilityStatus: asset.availabilityStatus
          ? {
              id: asset.availabilityStatus.id,
              code: asset.availabilityStatus.code,
              name: asset.availabilityStatus.name,
            }
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

  /**
   * Request asset disposal: Transition asset directly into WAIT_DISPOSAL and set availability to UNAVAILABLE.
   * Records reason and updates audit remarks.
   */
  async requestDisposal(id: string, dto: RequestDisposalDto, userId?: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        status: true,
        availabilityStatus: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ID "${id}" not found`);
    }

    if (asset.status?.code === 'DISPOSAL') {
      throw new BadRequestException(
        'Asset has already been permanently disposed',
      );
    }

    if (asset.status?.code === 'LOST') {
      throw new BadRequestException('Asset is currently marked as lost');
    }

    if (asset.status?.code === 'WAIT_DISPOSAL') {
      throw new BadRequestException('Asset is already in WAIT_DISPOSAL status');
    }

    if (asset.availabilityStatus?.code === 'BORROWED') {
      throw new BadRequestException(
        'Cannot request disposal for an asset that is currently borrowed',
      );
    }

    const waitDisposalStatus = await this.prisma.assetStatus.findUnique({
      where: { code: 'WAIT_DISPOSAL' },
    });
    if (!waitDisposalStatus) {
      throw new NotFoundException('Status WAIT_DISPOSAL not found in database');
    }

    const unavailableStatus = await this.prisma.availabilityStatus.findUnique({
      where: { code: 'UNAVAILABLE' },
    });
    if (!unavailableStatus) {
      throw new NotFoundException('Status UNAVAILABLE not found in database');
    }

    const reasonNote = dto.reason?.trim()
      ? `[เสนอรอจำหน่าย]: ${dto.reason.trim()}`
      : '';
    const locationNote = dto.storageLocation?.trim()
      ? `[สถานที่พักซาก]: ${dto.storageLocation.trim()}`
      : '';
    const additionalNotes = [reasonNote, locationNote]
      .filter(Boolean)
      .join(' | ');

    const updatedRemark = additionalNotes
      ? asset.remark
        ? `${asset.remark}\n${additionalNotes}`
        : additionalNotes
      : asset.remark;

    const updatedAsset = await this.prisma.asset.update({
      where: { id },
      data: {
        asset_status_id: waitDisposalStatus.id,
        availability_status_id: unavailableStatus.id,
        remark: updatedRemark,
        ...(userId && { updatedBy: userId }),
      },
      include: {
        status: true,
        availabilityStatus: true,
        section: true,
      },
    });

    return {
      success: true,
      message:
        'ปรับสถานะครุภัณฑ์เป็น WAIT_DISPOSAL (รอจำหน่าย) และล็อกเป็น UNAVAILABLE เรียบร้อยแล้ว',
      asset: {
        id: updatedAsset.id,
        noid: updatedAsset.noid,
        name: updatedAsset.name,
        model: updatedAsset.model,
        status: {
          id: updatedAsset.status.id,
          code: updatedAsset.status.code,
          name: updatedAsset.status.name,
        },
        availabilityStatus: {
          id: updatedAsset.availabilityStatus?.id,
          code: updatedAsset.availabilityStatus?.code,
          name: updatedAsset.availabilityStatus?.name,
        },
        section: updatedAsset.section
          ? { id: updatedAsset.section.id, name: updatedAsset.section.name }
          : null,
        remark: updatedAsset.remark,
        requestedDisposalReason: dto.reason,
        storageLocation: dto.storageLocation,
        updatedAt: updatedAsset.updatedAt,
      },
    };
  }
}
