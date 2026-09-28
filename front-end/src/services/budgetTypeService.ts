import { apiClient } from "./apiClient";
import type {
  BudgetType,
  CreateBudgetTypeDto,
  UpdateBudgetTypeDto,
} from "../types/TypeBudgetType";


export async function getBudgetTypes(): Promise<BudgetType[]> {
  const res = await apiClient.get(`/budget-types`);
  const data = res.data;
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function getBudgetTypeById(id: number): Promise<BudgetType> {
  const res = await apiClient.get(`/budget-types/${id}`);
  return res.data;
}

export async function createBudgetType(
  dto: CreateBudgetTypeDto,
): Promise<BudgetType> {
  const res = await apiClient.post(`/budget-types`, dto);
  return res.data;
}

export async function updateBudgetType(
  id: number,
  dto: UpdateBudgetTypeDto,
): Promise<BudgetType> {
  const res = await apiClient.patch(
    `/budget-types/${id}`,
    dto,
  );
  return res.data;
}

export async function deleteBudgetType(id: number): Promise<void> {
  await apiClient.delete(`/budget-types/${id}`);
}

export async function restoreBudgetType(id: number): Promise<void> {
  await apiClient.patch(`/budget-types/${id}/restore`, {});
}
