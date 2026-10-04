import { apiClient } from "./apiClient";
import type {
  AssetType,
  Asset,
  Availabilities,
  AssetStatus,
  Section,
  PaginatedResponse,
  AssetQueryParams,
} from "../types/TypeAsset";

export async function getAssetsPaginated(
  params?: AssetQueryParams,
): Promise<PaginatedResponse<Asset>> {

  const cleanParams: Record<string, any> = {};
  if (params) {
    if (params.page !== undefined) cleanParams.page = params.page;
    if (params.limit !== undefined) cleanParams.limit = params.limit;
    if (params.search && params.search.trim() !== "")
      cleanParams.search = params.search.trim();
    if (params.section_id && params.section_id !== "ALL")
      cleanParams.section_id = params.section_id;
    if (params.asset_status_id !== undefined)
      cleanParams.asset_status_id = params.asset_status_id;
    if (params.asset_type_id !== undefined)
      cleanParams.asset_type_id = params.asset_type_id;
    if (params.availability_status_id !== undefined)
      cleanParams.availability_status_id = params.availability_status_id;
    if (params.equipment_type_id !== undefined)
      cleanParams.equipment_type_id = params.equipment_type_id;
  }

  const res = await apiClient.get("/asset", {

    params: cleanParams,
  });

  const raw = res.data;
  const data: Asset[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
  const meta = raw?.meta ?? {
    page: params?.page ?? 1,
    limit: params?.limit ?? data.length,
    total: raw?.total ?? data.length,
    totalPages:
      Math.ceil((raw?.total ?? data.length) / (params?.limit ?? 10)) || 1,
  };

  return { data, meta };
}

export async function getMySectionAssetsPaginated(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResponse<Asset>> {

  const cleanParams: Record<string, any> = {};
  if (params) {
    if (params.page !== undefined) cleanParams.page = params.page;
    if (params.limit !== undefined) cleanParams.limit = params.limit;
    if (params.search && params.search.trim() !== "")
      cleanParams.search = params.search.trim();
  }

  const res = await apiClient.get(
    "/asset/my-section",
    {

      params: cleanParams,
    },
  );

  const raw = res.data;
  const data: Asset[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
  const meta = raw?.meta ?? {
    page: params?.page ?? 1,
    limit: params?.limit ?? data.length,
    total: raw?.total ?? data.length,
    totalPages:
      Math.ceil((raw?.total ?? data.length) / (params?.limit ?? 10)) || 1,
  };

  return { data, meta };
}

export async function getAssets(
  section_id?: string | number,
): Promise<Asset[]> {

  const res = await apiClient.get("/asset", {

    params: {
      ...(section_id && { section_id }),
    },
  });

  return res.data.data;
}

export async function getAssetTypes(): Promise<AssetType[]> {

  const res = await apiClient.get("/asset-type");

  return res.data;
}

export async function getAvailabilities(): Promise<Availabilities[]> {

  const res = await apiClient.get("/availabilities");

  return res.data;
}

export async function getAssetStatuses(): Promise<AssetStatus[]> {

  const res = await apiClient.get("/asset-status");

  return res.data;
}

export async function getSections(): Promise<Section[]> {

  const res = await apiClient.get("/sections");

  return res.data;
}

export async function getMySectionAssets(): Promise<Asset[]> {

  const res = await apiClient.get("/asset/my-section");

  return res.data.data;
}

export async function getAssetsBySection(sectionId: string): Promise<Asset[]> {

  const res = await apiClient.get(`/asset/section/${sectionId}`);

  return res.data.data;
}

export async function createAsset(data: any): Promise<Asset> {

  const res = await apiClient.post("/asset", data);

  return res.data;
}

export async function updateAsset(id: string, data: any): Promise<Asset> {

  const res = await apiClient.patch(`/asset/${id}`, data);

  return res.data;
}

export async function getAssetById(id: string): Promise<Asset> {
  const res = await apiClient.get(`/asset/${encodeURIComponent(id)}`);
  return res.data;
}

export async function getBudgetTypes(): Promise<any[]> {

  const res = await apiClient.get("/budget-types");

  const raw = res.data;
  return Array.isArray(raw) ? raw : (raw?.data ?? []);
}

export async function getEquipmentTypes(): Promise<any[]> {

  const res = await apiClient.get("/equipment-types");

  const raw = res.data;
  return Array.isArray(raw) ? raw : (raw?.data ?? []);
}

export async function getAllUsers(): Promise<any[]> {

  const res = await apiClient.get("/users");

  const raw = res.data;
  return Array.isArray(raw) ? raw : (raw?.data ?? []);
}
