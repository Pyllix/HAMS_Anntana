import axios from "axios";
import type {
  RepairJob,
  EvaluationDto,
  Company,
  SparePart,
  RepairCause,
} from "../Types/TypeAssessment";
import type { User } from "../Types/TypeUser";

const BASE_URL = "https://hams-anntana.onrender.com";

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export async function getPendingEvaluations(): Promise<RepairJob[]> {
  const res = await axios.get(`${BASE_URL}/repair-jobs/pending`, getHeaders());
  return res.data;
}

export async function getRepairJobById(id: number): Promise<RepairJob> {
  const res = await axios.get(`${BASE_URL}/repair-jobs/${id}`, getHeaders());
  return res.data;
}

export async function createEvaluation(dto: EvaluationDto): Promise<RepairJob> {
  const res = await axios.post(
    `${BASE_URL}/repair-jobs/evaluate`,
    dto,
    getHeaders(),
  );
  return res.data;
}

/**
 * ดึงรายการผู้ใช้งานทั้งหมด
 */
export async function getUsers(): Promise<User[]> {
  const res = await axios.get(`${BASE_URL}/users`, getHeaders());
  return res.data;
}

/**
 * ดึงรายการบริษัททั้งหมด
 */
export async function getCompanies(): Promise<Company[]> {
  const res = await axios.get(`${BASE_URL}/company`, getHeaders());
  return res.data;
}

/**
 * ดึงรายการอะไหล่ทั้งหมด
 */
export async function getSpareParts(): Promise<SparePart[]> {
  const res = await axios.get(`${BASE_URL}/spare-parts`, getHeaders());
  return res.data;
}

/**
 * ดึงรายการสาเหตุการเสียทั้งหมด
 */
export async function getCauses(): Promise<RepairCause[]> {
  const res = await axios.get(`${BASE_URL}/repair-causes`, getHeaders());
  return res.data;
}
