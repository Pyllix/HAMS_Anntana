import axios from "axios";
import type {
  BudgetType,
  CreateBudgetTypeDto,
  UpdateBudgetTypeDto,
} from "../Types/TypeBudgetType";

const BASE_URL = "https://hams-anntana.onrender.com";

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export async function getBudgetTypes(): Promise<BudgetType[]> {
  const res = await axios.get(`${BASE_URL}/budget-types`, getHeaders());
  const data = res.data;
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function getBudgetTypeById(id: number): Promise<BudgetType> {
  const res = await axios.get(`${BASE_URL}/budget-types/${id}`, getHeaders());
  return res.data;
}

export async function createBudgetType(
  dto: CreateBudgetTypeDto,
): Promise<BudgetType> {
  const res = await axios.post(`${BASE_URL}/budget-types`, dto, getHeaders());
  return res.data;
}

export async function updateBudgetType(
  id: number,
  dto: UpdateBudgetTypeDto,
): Promise<BudgetType> {
  const res = await axios.patch(
    `${BASE_URL}/budget-types/${id}`,
    dto,
    getHeaders(),
  );
  return res.data;
}

export async function deleteBudgetType(id: number): Promise<void> {
  await axios.delete(`${BASE_URL}/budget-types/${id}`, getHeaders());
}

export async function restoreBudgetType(id: number): Promise<void> {
  await axios.patch(`${BASE_URL}/budget-types/${id}/restore`, {}, getHeaders());
}
