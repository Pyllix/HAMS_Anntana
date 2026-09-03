import axios from "axios";
import type {
  RepairListItem,
  RepairDetailDto,
  Company,
  SparePart,
  RepairDetail,
  Mechanic,
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
  return res.data;
}

export async function getRepairJobById(id: number): Promise<RepairDetail> {
  const res = await axios.get(`${BASE_URL}/repairs/${id}`, getHeaders());
  return res.data;
}

export async function createEvaluation(
  id: string,
  dto: RepairDetailDto,
): Promise<RepairDetail> {
  const res = await axios.post(
    `${BASE_URL}/repairs/${id}/diagnose`,
    dto,
    getHeaders(),
  );
  return res.data;
}

export async function getMechanics(): Promise<Mechanic[]> {
  const res = await axios.get(`${BASE_URL}/repairs/mechanics`, getHeaders());
  return res.data;
}

export async function getCompanies(): Promise<Company[]> {
  const res = await axios.get(`${BASE_URL}/company`, getHeaders());
  return res.data;
}

export async function getSpareParts(): Promise<SparePart[]> {
  const res = await axios.get(`${BASE_URL}/spare-parts`, getHeaders());
  return res.data;
}

export async function getRepairMetaLookups(): Promise<RepairMetaLookups> {
  const res = await axios.get(`${BASE_URL}/repairs/lookups/meta`, getHeaders());
  return res.data;
}
