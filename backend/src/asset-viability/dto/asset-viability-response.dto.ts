import { ApiProperty } from '@nestjs/swagger';

export type ViabilityStatus = 'VIABLE' | 'WARNING' | 'UNVIABLE';

export class AssetViabilitySummaryDto {
  @ApiProperty({ example: 150, description: 'Total assets evaluated' })
  totalEvaluated: number;

  @ApiProperty({ example: 118, description: 'Assets deemed economically viable to repair' })
  viableCount: number;

  @ApiProperty({ example: 22, description: 'Assets requiring caution/monitoring' })
  warningCount: number;

  @ApiProperty({ example: 10, description: 'Assets deemed unviable - recommended for disposal' })
  unviableCount: number;

  @ApiProperty({ example: 1254000.0, description: 'Total cumulative repair cost across evaluated assets' })
  totalCumulativeRepairCost: number;
}

export class AssetViabilityMetricsDto {
  @ApiProperty({ example: 8.5, description: 'Asset age in years' })
  ageYears: number;

  @ApiProperty({ example: 5, description: 'Standard useful life in years' })
  usefulLifeYears: number;

  @ApiProperty({ example: true, description: 'True if asset age exceeds useful life' })
  isUsefulLifeExceeded: boolean;

  @ApiProperty({ example: 337500.0, description: 'Cumulative repair cost in THB' })
  cumulativeRepairCost: number;

  @ApiProperty({ example: 75.0, nullable: true, description: 'Cumulative cost as percentage of purchase price' })
  costRatioPercentage: number | null;

  @ApiProperty({ example: 6, description: 'Lifetime total repair jobs count' })
  totalRepairCount: number;

  @ApiProperty({ example: 2, description: 'Repair jobs within the past 365 days' })
  recentRepairCount: number;
}

export class AssetViabilityItemDto {
  @ApiProperty({ example: 'uuid-asset-1' })
  id: string;

  @ApiProperty({ example: 'MD-67-0012', nullable: true })
  noid: string | null;

  @ApiProperty({ example: 'เครื่องช่วยหายใจชนิดควบคุมด้วยปริมาตรและความดัน' })
  name: string;

  @ApiProperty({ example: 'Puritan Bennett 840' })
  model: string;

  @ApiProperty({ example: 'SN-PB840-098', nullable: true })
  serialNo: string | null;

  @ApiProperty({ example: 450000.0 })
  price: number;

  @ApiProperty({ example: '2018-03-15T00:00:00.000Z' })
  receivedDate: string;

  @ApiProperty({ example: '2020-03-14', nullable: true })
  warrantyDate: string | null;

  @ApiProperty({ example: false })
  isWarrantyActive: boolean;

  @ApiProperty({ example: { id: 1, name: 'เครื่องมือแพทย์', usefulLife: 5 } })
  assetType: {
    id: number;
    name: string;
    usefulLife: number;
  };

  @ApiProperty({ example: { id: 'uuid-sec-icu', name: 'หอผู้ป่วยวิกฤต (ICU)' } })
  section: {
    id: string;
    name: string;
  };

  @ApiProperty({ example: { id: 1, code: 'NORMAL', name: 'ใช้งานปกติ' } })
  assetStatus: {
    id: number;
    code: string;
    name: string;
  };

  @ApiProperty({ type: AssetViabilityMetricsDto })
  metrics: AssetViabilityMetricsDto;

  @ApiProperty({ example: 'UNVIABLE', enum: ['VIABLE', 'WARNING', 'UNVIABLE'] })
  viabilityStatus: ViabilityStatus;

  @ApiProperty({ example: 'ค่าซ่อมสะสม (฿337,500.00) คิดเป็น 75.0% ของราคาจัดซื้อ ซึ่งเกินเกณฑ์ร้อยละ 70 ตามระเบียบพัสดุ' })
  viabilityReason: string;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 150 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 8 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNext: boolean;

  @ApiProperty({ example: false })
  hasPrev: boolean;
}

export class AssetViabilityListResponseDto {
  @ApiProperty({ type: AssetViabilitySummaryDto })
  summary: AssetViabilitySummaryDto;

  @ApiProperty({ type: [AssetViabilityItemDto] })
  items: AssetViabilityItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}

export class SparePartUsageItemDto {
  @ApiProperty({ example: 'SP-001' })
  code: string;

  @ApiProperty({ example: 'วาล์วควบคุมแรงดัน' })
  name: string;

  @ApiProperty({ example: 2 })
  qty: number;

  @ApiProperty({ example: 2500.0 })
  unitPrice: number;

  @ApiProperty({ example: 5000.0 })
  totalPrice: number;

  @ApiProperty({ example: 'WITHDRAW' })
  txnType: string;
}

export class HistoricalRepairJobDto {
  @ApiProperty({ example: 'uuid-job-1' })
  jobId: string;

  @ApiProperty({ example: 'REP-2026-001' })
  jobNo: string;

  @ApiProperty({ example: 'Repair' })
  reportType: string;

  @ApiProperty({ example: 'OUTSOURCE', nullable: true })
  actionType: string | null;

  @ApiProperty({ example: '2026-05-10T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: 'บอร์ดควบคุมแรงดันลมไม่จ่ายไฟ', nullable: true })
  symptom: string | null;

  @ApiProperty({ example: 'ส่งซ่อมเปลี่ยนบอร์ดควบคุมหลักผ่านบริษัทตัวแทน', nullable: true })
  solution: string | null;

  @ApiProperty({ example: 45000.0 })
  outsourceCost: number;

  @ApiProperty({ example: 5000.0 })
  sparePartsCost: number;

  @ApiProperty({ example: 50000.0 })
  totalCost: number;

  @ApiProperty({ type: [SparePartUsageItemDto] })
  spareParts: SparePartUsageItemDto[];
}

export class DisposalRecommendationDto {
  @ApiProperty({ example: 'RECOMMEND_DISPOSAL', enum: ['PROCEED_REPAIR', 'CAUTION_REPAIR', 'RECOMMEND_DISPOSAL'] })
  recommendedAction: 'PROCEED_REPAIR' | 'CAUTION_REPAIR' | 'RECOMMEND_DISPOSAL';

  @ApiProperty({ example: 'เสนอพิจารณาแทงจำหน่าย' })
  actionLabel: string;

  @ApiProperty({ example: true })
  canInitiateDisposal: boolean;

  @ApiProperty({ example: null, nullable: true })
  blockReason: string | null;

  @ApiProperty({
    example: {
      assetId: 'uuid-asset-1',
      noid: 'MD-67-0012',
      name: 'เครื่องช่วยหายใจชนิดควบคุมด้วยปริมาตรและความดัน',
      price: 450000.0,
      cumulativeRepairCost: 337500.0,
      costRatioPercentage: 75.0,
      suggestedDisposalReason: 'แทงจำหน่ายเนื่องจากประเมินแล้วซ่อมไม่คุ้มค่า: ค่าซ่อมสะสม (฿337,500.00) คิดเป็น 75.0% ของราคาจัดซื้อ ซึ่งเกินเกณฑ์ร้อยละ 70 ตามระเบียบพัสดุ',
      suggestedDocPrefix: 'DISP-2567-',
    },
  })
  prefillData: {
    assetId: string;
    noid: string | null;
    name: string;
    price: number;
    cumulativeRepairCost: number;
    costRatioPercentage: number | null;
    suggestedDisposalReason: string;
    suggestedDocPrefix: string;
  };
}

export class AssetViabilityDetailResponseDto {
  @ApiProperty()
  asset: Record<string, any>;

  @ApiProperty()
  viability: {
    status: ViabilityStatus;
    reason: string;
    costRatioPercentage: number | null;
    ageYears: number;
    usefulLifeYears: number;
    isUsefulLifeExceeded: boolean;
    isWarrantyActive: boolean;
    totalRepairCount: number;
    recentRepairCount: number;
    financials: {
      originalPrice: number;
      cumulativeRepairCost: number;
      totalOutsourceCost: number;
      totalSparePartsCost: number;
    };
  };

  @ApiProperty({ type: [HistoricalRepairJobDto] })
  repairHistory: HistoricalRepairJobDto[];

  @ApiProperty({ type: DisposalRecommendationDto })
  disposalRecommendation: DisposalRecommendationDto;
}
