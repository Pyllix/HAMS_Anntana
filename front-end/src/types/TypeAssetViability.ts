export type ViabilityStatus = "VIABLE" | "WARNING" | "UNVIABLE";

export type ViabilityStatusFilter = "ALL" | "VIABLE" | "WARNING" | "UNVIABLE";

export type ViabilitySortBy =
  | "costRatio"
  | "cumulativeCost"
  | "repairCount"
  | "age"
  | "createdAt";

export type SortOrder = "asc" | "desc";

export interface AssetViabilitySummary {
  totalEvaluated: number;
  viableCount: number;
  warningCount: number;
  unviableCount: number;
  totalCumulativeRepairCost: number;
}

export interface AssetViabilityMetrics {
  ageYears: number;
  usefulLifeYears: number;
  isUsefulLifeExceeded: boolean;
  cumulativeRepairCost: number;
  costRatioPercentage: number | null;
  totalRepairCount: number;
  recentRepairCount: number;
}

export interface AssetViabilityItem {
  id: string;
  noid: string | null;
  name: string;
  model: string;
  serialNo: string | null;
  price: number;
  receivedDate: string;
  warrantyDate: string | null;
  isWarrantyActive: boolean;
  assetType: {
    id: number;
    name: string;
    usefulLife: number;
  };
  section: {
    id: string;
    name: string;
  };
  assetStatus: {
    id: number;
    code: string;
    name: string;
  };
  metrics: AssetViabilityMetrics;
  viabilityStatus: ViabilityStatus;
  viabilityReason: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AssetViabilityListResponse {
  summary: AssetViabilitySummary;
  items: AssetViabilityItem[];
  pagination: PaginationMeta;
}

export interface SparePartUsageItem {
  code: string;
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  txnType: string;
}

export interface HistoricalRepairJob {
  jobId: string;
  jobNo: string;
  reportType: string;
  actionType: string | null;
  createdAt: string;
  symptom: string | null;
  solution: string | null;
  outsourceCost: number;
  sparePartsCost: number;
  totalCost: number;
  spareParts: SparePartUsageItem[];
}

export interface DisposalPrefillData {
  assetId: string;
  noid: string | null;
  name: string;
  price: number;
  cumulativeRepairCost: number;
  costRatioPercentage: number | null;
  suggestedDisposalReason: string;
  suggestedDocPrefix: string;
}

export interface DisposalRecommendation {
  recommendedAction: "PROCEED_REPAIR" | "CAUTION_REPAIR" | "RECOMMEND_DISPOSAL";
  actionLabel: string;
  canInitiateDisposal: boolean;
  blockReason: string | null;
  prefillData: DisposalPrefillData;
}

export interface AssetViabilityDetailResponse {
  asset: {
    id: string;
    noid: string | null;
    name: string;
    model: string;
    serialNo: string | null;
    price: number;
    receivedDate: string;
    warrantyDate: string | null;
    remark: string | null;
    section: {
      id: string;
      name: string;
    } | null;
    type: {
      id: number;
      name: string;
      usefulLife: number;
    } | null;
    status: {
      id: number;
      code: string;
      name: string;
    } | null;
    availabilityStatus: {
      id: number;
      code: string;
      name: string;
    } | null;
  };
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
  repairHistory: HistoricalRepairJob[];
  disposalRecommendation: DisposalRecommendation;
}

export interface RequestDisposalDto {
  reason?: string;
  storageLocation?: string;
}

export interface QueryAssetViabilityParams {
  page?: number;
  limit?: number;
  viabilityStatus?: ViabilityStatusFilter;
  sectionId?: string;
  assetTypeId?: number;
  search?: string;
  sortBy?: ViabilitySortBy;
  sortOrder?: SortOrder;
  includeDisposed?: boolean;
}
