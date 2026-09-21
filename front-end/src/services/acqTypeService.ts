import axios from "axios";
import type {
  AcqType,
  CreateAcqTypeDto,
  UpdateAcqTypeDto,
} from "../types/TypeAcqType";

const BASE_URL = "https://hams-anntana.onrender.com";

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export async function getAcqTypes(): Promise<AcqType[]> {
  const res = await axios.get(`${BASE_URL}/acq-types`, getHeaders());
  const data = res.data;
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function getAcqTypeById(id: number): Promise<AcqType> {
  const res = await axios.get(`${BASE_URL}/acq-types/${id}`, getHeaders());
  return res.data;
}

export async function createAcqType(
  dto: CreateAcqTypeDto,
): Promise<AcqType> {
  const res = await axios.post(`${BASE_URL}/acq-types`, dto, getHeaders());
  return res.data;
}

export async function updateAcqType(
  id: number,
  dto: UpdateAcqTypeDto,
): Promise<AcqType> {
  const res = await axios.patch(
    `${BASE_URL}/acq-types/${id}`,
    dto,
    getHeaders(),
  );
  return res.data;
}

export async function deleteAcqType(id: number): Promise<void> {
  await axios.delete(`${BASE_URL}/acq-types/${id}`, getHeaders());
}

export async function restoreAcqType(id: number): Promise<void> {
  await axios.patch(`${BASE_URL}/acq-types/${id}/restore`, {}, getHeaders());
}
