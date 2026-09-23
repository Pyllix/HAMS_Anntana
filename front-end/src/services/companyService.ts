import axios from "axios";
import type {
  Company,
  CreateCompanyDto,
  UpdateCompanyDto,
} from "../types/TypeCompany";

const BASE_URL = "https://hams-anntana.onrender.com";

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export async function getCompanies(): Promise<Company[]> {
  const res = await axios.get(`${BASE_URL}/company`, getHeaders());
  const data = res.data;
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function getCompanyById(id: string | number): Promise<Company> {
  const res = await axios.get(`${BASE_URL}/company/${id}`, getHeaders());
  return res.data;
}

export async function createCompany(dto: CreateCompanyDto): Promise<Company> {
  // Strip non-whitelisted fields (e.g. isActive) to prevent backend 400 Bad Request
  const { isActive, ...payload } = dto;
  console.log("🚀 [POST /company] Sending Payload to Backend:", payload);
  const res = await axios.post(`${BASE_URL}/company`, payload, getHeaders());
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
  const res = await axios.patch(
    `${BASE_URL}/company/${id}`,
    payload,
    getHeaders(),
  );
  console.log(`✅ [PATCH /company/${id}] Backend Response:`, res.data);
  return res.data;
}

export async function deleteCompany(id: string | number): Promise<void> {
  console.log(`🗑️ [DELETE /company/${id}] Sending Delete Request to Backend`);
  await axios.delete(`${BASE_URL}/company/${id}`, getHeaders());
  console.log(`✅ [DELETE /company/${id}] Delete successful`);
}

export async function restoreCompany(id: string | number): Promise<void> {
  await axios.patch(`${BASE_URL}/company/${id}/restore`, {}, getHeaders());
}
