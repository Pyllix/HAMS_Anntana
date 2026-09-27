import { apiClient } from "./apiClient";
import type {
  AcqType,
  CreateAcqTypeDto,
  UpdateAcqTypeDto,
} from "../types/TypeAcqType";


export async function getAcqTypes(): Promise<AcqType[]> {
  const res = await apiClient.get(`/acq-types`);
  const data = res.data;
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function getAcqTypeById(id: number): Promise<AcqType> {
  const res = await apiClient.get(`/acq-types/${id}`);
  return res.data;
}

export async function createAcqType(
  dto: CreateAcqTypeDto,
): Promise<AcqType> {
  const res = await apiClient.post(`/acq-types`, dto);
  return res.data;
}

export async function updateAcqType(
  id: number,
  dto: UpdateAcqTypeDto,
): Promise<AcqType> {
  const res = await apiClient.patch(
    `/acq-types/${id}`,
    dto,
  );
  return res.data;
}

export async function deleteAcqType(id: number): Promise<void> {
  await apiClient.delete(`/acq-types/${id}`);
}

export async function restoreAcqType(id: number): Promise<void> {
  await apiClient.patch(`/acq-types/${id}/restore`, {});
}
