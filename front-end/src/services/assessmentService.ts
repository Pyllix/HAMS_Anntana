import axios from "axios";
import type {
  RepairListItem,
  RepairDetail,
  AssignMechanicDto,
  DiagnoseDto,
  AdvanceStepDto,
  RejectStepDto,
  CompleteUnrepairableDto,
  CancelRepairDto,
  ReturnSparePartDto,
  Mechanic,
  SparePart,
  RepairMetaLookups,
} from "../Types/TypeAssessment";

const BASE_URL = "https://hams-anntana.onrender.com";

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export async function getPendingEvaluations(): Promise<RepairListItem[]> {
  const res = await axios.get(`${BASE_URL}/repairs`, getHeaders());

  return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
}

export async function getRepairJobById(
  id: string | number,
): Promise<RepairDetail> {
  const res = await axios.get(`${BASE_URL}/repairs/${id}`, getHeaders());

  return res.data;
}

export async function assignMechanics(
  id: string,
  dto: AssignMechanicDto,
): Promise<RepairDetail> {
  const res = await axios.post(
    `${BASE_URL}/repairs/${id}/assign`,
    dto,
    getHeaders(),
  );

  return res.data;
}

export async function createEvaluation(
  id: string,
  dto: DiagnoseDto,
): Promise<RepairDetail> {
  const res = await axios.patch(
    `${BASE_URL}/repairs/${id}/diagnose`,
    dto,
    getHeaders(),
  );

  return res.data;
}

export async function advanceRepairStep(
  id: string,
  dto: AdvanceStepDto,
): Promise<RepairDetail> {
  const res = await axios.patch(
    `${BASE_URL}/repairs/${id}/steps/next`,
    dto,
    getHeaders(),
  );

  return res.data;
}

export async function rejectRepairStep(
  id: string,
  dto: RejectStepDto,
): Promise<RepairDetail> {
  const res = await axios.patch(
    `${BASE_URL}/repairs/${id}/steps/reject`,
    dto,
    getHeaders(),
  );

  return res.data;
}

export async function completeUnrepairable(
  id: string,
  dto: CompleteUnrepairableDto,
): Promise<RepairDetail> {
  const res = await axios.patch(
    `${BASE_URL}/repairs/${id}/complete-unrepairable`,
    dto,
    getHeaders(),
  );

  return res.data;
}

export async function cancelRepairJob(
  id: string,
  dto: CancelRepairDto | { reason?: string },
): Promise<RepairDetail> {
  const payload = {
    reason: (dto as any).reason || (dto as any).solution || "",
  };

  const res = await axios.patch(
    `${BASE_URL}/repairs/${id}/cancel`,
    payload,
    getHeaders(),
  );

  return res.data;
}

export async function returnSparePart(
  id: string,
  dto: ReturnSparePartDto,
): Promise<void> {
  await axios.post(
    `${BASE_URL}/repairs/${id}/spare-parts/return`,
    dto,
    getHeaders(),
  );
}

export async function getMechanics(): Promise<Mechanic[]> {
  const res = await axios.get(`${BASE_URL}/repairs/mechanics`, getHeaders());

  return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
}

export async function getMechanicWorkloads(): Promise<Mechanic[]> {
  const res = await axios.get(
    `${BASE_URL}/repairs/mechanic-workloads`,
    getHeaders(),
  );

  return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
}

export async function getSpareParts(): Promise<SparePart[]> {
  const res = await axios.get(`${BASE_URL}/spare-parts`, getHeaders());

  return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
}

export async function getRepairMetaLookups(): Promise<RepairMetaLookups> {
  const res = await axios.get(`${BASE_URL}/repairs/lookups/meta`, getHeaders());

  return res.data;
}
