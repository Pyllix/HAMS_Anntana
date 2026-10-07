export interface BorrowDto {
  assetId: string;
  borrowerId: string;
  deliveryMethod: "PICKUP";
}

export interface Borrow {
  id: string;
  asset_id: string;
  borrower_id: string;
  returned_by_user_id: string | null;
  received_by_user_id: string | null;
  borrow_status_id: number;
  return_date: string | null;
  return_condition: string | null;
  return_method: string | null;
  return_remark: string | null;
  request_source: string;
  delivery_method: string;
  createdAt: string;
}

// GET /borrowings/recommendations — จัดอันดับเครื่องรุ่นเดียวกันที่พร้อมยืมตามการหมุนเวียนใช้งาน
export interface BorrowRecommendationCandidate {
  assetId: string;
  noid: string | null;
  name: string;
  model: string;
  serialNo: string | null;
  sectionName: string | null;
  imageUrl: string | null;
  usageDays90d: number;
  idleDays: number;
  borrowCount90d: number;
  isRecommended: boolean;
  recommendationReason: string;
}

export interface BorrowRecommendations {
  model?: string;
  equipmentTypeId?: number;
  totalAvailable: number;
  recommendedAssetId: string | null;
  candidates: BorrowRecommendationCandidate[];
}
