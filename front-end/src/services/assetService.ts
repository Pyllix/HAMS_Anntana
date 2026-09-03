import axios from "axios";
import type {
  AssetType,
  Asset,
  Availabilities,
  AssetStatus,
  Section,
} from "../types/TypeAsset";

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
