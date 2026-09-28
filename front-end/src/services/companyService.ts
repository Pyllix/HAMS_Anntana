import { apiClient } from "./apiClient";
import type {
  Company,
  CreateCompanyDto,
  UpdateCompanyDto,
} from "../types/TypeCompany";


export async function getCompanies(): Promise<Company[]> {
  const res = await apiClient.get(`/company`);
  const data = res.data;
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function getCompanyById(id: string | number): Promise<Company> {
  const res = await apiClient.get(`/company/${id}`);
  return res.data;
}

export async function createCompany(dto: CreateCompanyDto): Promise<Company> {
  // Strip non-whitelisted fields (e.g. isActive) to prevent backend 400 Bad Request
  const { isActive, ...payload } = dto;
  console.log("🚀 [POST /company] Sending Payload to Backend:", payload);
  const res = await apiClient.post(`/company`, payload);
  console.log("✅ [POST /company] Backend Response:", res.data);
  return res.data;
}

export async function updateCompany(
  id: string | number,
  dto: UpdateCompanyDto,
): Promise<Company> {
  // Strip non-whitelisted fields (e.g. isActive) to prevent backend 400 Bad Request
  const { isActive, ...payload } = dto;
  console.log(`🚀 [PATCH /company/${id}] Sending Payload to Backend:`, payload);
  const res = await apiClient.patch(
    `/company/${id}`,
    payload,
  );
  console.log(`✅ [PATCH /company/${id}] Backend Response:`, res.data);
  return res.data;
}

export async function deleteCompany(id: string | number): Promise<void> {
  console.log(`🗑️ [DELETE /company/${id}] Sending Delete Request to Backend`);
  await apiClient.delete(`/company/${id}`);
  console.log(`✅ [DELETE /company/${id}] Delete successful`);
}

export async function restoreCompany(id: string | number): Promise<void> {
  await apiClient.patch(`/company/${id}/restore`, {});
}
