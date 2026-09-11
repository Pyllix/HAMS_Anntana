import axios from "axios";
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
  const token = localStorage.getItem("token");

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

  const res = await axios.get("https://hams-anntana.onrender.com/asset", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
  const token = localStorage.getItem("token");

  const cleanParams: Record<string, any> = {};
  if (params) {
    if (params.page !== undefined) cleanParams.page = params.page;
    if (params.limit !== undefined) cleanParams.limit = params.limit;
    if (params.search && params.search.trim() !== "")
      cleanParams.search = params.search.trim();
  }

  const res = await axios.get(
    "https://hams-anntana.onrender.com/asset/my-section",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
  const token = localStorage.getItem("token");

  const res = await axios.get("https://hams-anntana.onrender.com/asset", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      ...(section_id && { section_id }),
    },
  });

  return res.data.data;
}

export async function getAssetTypes(): Promise<AssetType[]> {
  const token = localStorage.getItem("token");

  const res = await axios.get("https://hams-anntana.onrender.com/asset-type", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
}

export async function getAvailabilities(): Promise<Availabilities[]> {
  const token = localStorage.getItem("token");

  const res = await axios.get(
    "https://hams-anntana.onrender.com/availabilities",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return res.data;
}

export async function getAssetStatuses(): Promise<AssetStatus[]> {
  const token = localStorage.getItem("token");

  const res = await axios.get(
    "https://hams-anntana.onrender.com/asset-status",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return res.data;
}

export async function getSections(): Promise<Section[]> {
  const token = localStorage.getItem("token");

  const res = await axios.get("https://hams-anntana.onrender.com/sections", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
}

export async function getMySectionAssets(): Promise<Asset[]> {
  const token = localStorage.getItem("token");

  const res = await axios.get(
    "https://hams-anntana.onrender.com/asset/my-section",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return res.data.data;
}

export async function getAssetsBySection(sectionId: string): Promise<Asset[]> {
  const token = localStorage.getItem("token");

  const res = await axios.get(
    `https://hams-anntana.onrender.com/asset/section/${sectionId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return res.data.data;
}
