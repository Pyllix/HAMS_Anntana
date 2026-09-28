import { apiClient } from "./apiClient";
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
  BaseLookup,
} from "../types/TypeAssessment";


export async function getPendingEvaluations(): Promise<RepairListItem[]> {
  const res = await apiClient.get(`/repairs`);

  return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
}

export async function getRepairJobById(
  id: string | number,
): Promise<RepairDetail> {
  const res = await apiClient.get(`/repairs/${id}`);

  return res.data;
}

export async function assignMechanics(
  id: string,
  dto: AssignMechanicDto,
): Promise<RepairDetail> {
  const res = await apiClient.post(
    `/repairs/${id}/assign`,
    dto,
  );

  return res.data;
}

export async function createEvaluation(
  id: string,
  dto: DiagnoseDto,
): Promise<RepairDetail> {
  const res = await apiClient.patch(
    `/repairs/${id}/diagnose`,
    dto,
  );

  return res.data;
}

export async function advanceRepairStep(
  id: string,
  dto: AdvanceStepDto,
): Promise<RepairDetail> {
  const res = await apiClient.patch(
    `/repairs/${id}/steps/next`,
    dto,
  );

  return res.data;
}

export async function rejectRepairStep(
  id: string,
  dto: RejectStepDto,
): Promise<RepairDetail> {
  const res = await apiClient.patch(
    `/repairs/${id}/steps/reject`,
    dto,
  );

  return res.data;
}

export async function completeUnrepairable(
  id: string,
  dto: CompleteUnrepairableDto,
): Promise<RepairDetail> {
  const res = await apiClient.patch(
    `/repairs/${id}/complete-unrepairable`,
    dto,
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

  const res = await apiClient.patch(
    `/repairs/${id}/cancel`,
    payload,
  );

  return res.data;
}

export async function returnSparePart(
  id: string,
  dto: ReturnSparePartDto,
): Promise<void> {
  await apiClient.post(
    `/repairs/${id}/spare-parts/return`,
    dto,
  );
}

export async function getMechanics(): Promise<Mechanic[]> {
  const res = await apiClient.get(`/repairs/mechanics`);

  return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
}

export async function getMechanicWorkloads(): Promise<Mechanic[]> {
  const res = await apiClient.get(
    `/repairs/mechanic-workloads`,
  );

  return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
}

export async function getSpareParts(): Promise<SparePart[]> {
  const res = await apiClient.get(`/spare-parts`);

  return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
}

export async function getAssetTypes(): Promise<BaseLookup[]> {
  const res = await apiClient.get(`/asset-type`);
  return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
}

export async function getRepairMetaLookups(): Promise<RepairMetaLookups> {
  const [metaRes, assetTypesRes] = await Promise.allSettled([
    apiClient.get(`/repairs/lookups/meta`),
    getAssetTypes(),
  ]);

  const metaData = metaRes.status === "fulfilled" ? metaRes.value.data : {};
  const assetTypesData = assetTypesRes.status === "fulfilled" ? assetTypesRes.value : [];

  return {
    ...metaData,
    assetTypes: assetTypesData,
    asset_types: assetTypesData,
    categories: assetTypesData,
  };
}