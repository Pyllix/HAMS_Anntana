import { apiClient } from "./apiClient";
import { getPage } from "./pagedApi";
import type { Page } from "./pagedApi";
import type { SparepartGroup } from "../types/TypeSparePart";

const BASE_URL = "/spare-part-groups";

type SparepartGroupListItem = SparepartGroup & {
  _count: { spareparts: number };
};

export interface SparepartGroupFilters {
  page?: number;
  limit?: number;
  search?: string;
}

export interface SparepartGroupDto {
  name: string;
}

export async function getSparepartGroupsPage(
  filters: SparepartGroupFilters = {},
  signal?: AbortSignal,
): Promise<Page<SparepartGroup>> {
  const result = await getPage<SparepartGroupListItem>(
    BASE_URL,
    { ...filters },
    signal,
  );

  return {
    ...result,
    data: result.data.map((group) => ({
      ...group,
      sparepartsCount: group._count.spareparts,
    })),
  };
}

export async function createSparepartGroup(
  dto: SparepartGroupDto,
): Promise<SparepartGroup> {
  const { data } = await apiClient.post<SparepartGroup>(BASE_URL, {
    name: dto.name.trim(),
  });
  return data;
}

export async function updateSparepartGroup(
  id: number,
  dto: SparepartGroupDto,
): Promise<SparepartGroup> {
  const { data } = await apiClient.patch<SparepartGroup>(`${BASE_URL}/${id}`, {
    name: dto.name.trim(),
  });
  return data;
}

export async function deleteSparepartGroup(id: number): Promise<void> {
  await apiClient.delete(`${BASE_URL}/${id}`);
}
