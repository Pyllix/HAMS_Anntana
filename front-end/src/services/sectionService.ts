import { apiClient } from "./apiClient";
import { Section } from "../types/TypeAsset";

export async function getSectionById(id: string): Promise<Section> {

  const res = await apiClient.get(`/sections/${id}`);

  return res.data;
}
