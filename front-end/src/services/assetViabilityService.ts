import { apiClient } from "./apiClient";
import type {
  AssetViabilityListResponse,
  AssetViabilityDetailResponse,
  QueryAssetViabilityParams,
  RequestDisposalDto,
} from "../types/TypeAssetViability";

const BASE_URL = "/assets";

/**
 * ดึงรายการครุภัณฑ์ทั้งหมดพร้อมผลวิเคราะห์ความคุ้มค่าเชิงเศรษฐศาสตร์
 */
export async function getAssetViabilityList(
  params?: QueryAssetViabilityParams,
): Promise<AssetViabilityListResponse> {
  const cleanParams: Record<string, any> = {};

  if (params) {
    if (params.page) cleanParams.page = params.page;
    if (params.limit) cleanParams.limit = params.limit;
    if (params.viabilityStatus && params.viabilityStatus !== "ALL") {
      cleanParams.viabilityStatus = params.viabilityStatus;
    }
    if (params.sectionId && params.sectionId !== "ALL" && params.sectionId !== "") {
      cleanParams.sectionId = params.sectionId;
    }
    if (params.assetTypeId !== undefined && params.assetTypeId !== null) {
      cleanParams.assetTypeId = params.assetTypeId;
    }
    if (params.search && params.search.trim() !== "") {
      cleanParams.search = params.search.trim();
    }
    if (params.sortBy) cleanParams.sortBy = params.sortBy;
    if (params.sortOrder) cleanParams.sortOrder = params.sortOrder;
    if (params.includeDisposed !== undefined) {
      cleanParams.includeDisposed = params.includeDisposed;
    }
  }

  const res = await apiClient.get<AssetViabilityListResponse>(
    `${BASE_URL}/viability`,
    { params: cleanParams },
  );

  return res.data;
}

/**
 * ดึงผลวิเคราะห์เจาะลึกความคุ้มค่ารายเครื่อง (Single Deep-dive)
 * รวมประวัติงานซ่อม อะไหล่ที่เคยเบิก และข้อมูล prefillData สำหรับเสนอแทงจำหน่าย
 */
export async function getAssetViabilityDetail(
  id: string,
): Promise<AssetViabilityDetailResponse> {
  const res = await apiClient.get<AssetViabilityDetailResponse>(
    `${BASE_URL}/${id}/viability`,
  );

  return res.data;
}

/**
 * เสนอขอแทงจำหน่ายครุภัณฑ์ (Use Case C)
 * ปรับสถานะครุภัณฑ์เป็น WAIT_DISPOSAL (รอจำหน่าย) และล็อกห้ามยืม (UNAVAILABLE) ทันที
 */
export async function requestAssetDisposal(
  id: string,
  dto: RequestDisposalDto,
): Promise<{ message: string; assetId: string }> {
  const res = await apiClient.post(
    `${BASE_URL}/${id}/request-disposal`,
    dto,
  );

  return res.data;
}
