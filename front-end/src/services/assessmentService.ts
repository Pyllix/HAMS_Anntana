import axios from "axios";
import type { RepairJob, EvaluationDto } from "../Types/TypeAssessment";

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
  const res = await axios.get(
    `${BASE_URL}/repair-jobs/pending`,
    getHeaders()
  );
  return res.data;
}

export async function getRepairJobById(id: number): Promise<RepairJob> {
  const res = await axios.get(
    `${BASE_URL}/repair-jobs/${id}`,
    getHeaders()
  );
  return res.data;
}

export async function createEvaluation(
  dto: EvaluationDto
): Promise<RepairJob> {
  const res = await axios.post(
    `${BASE_URL}/repair-jobs/evaluate`,
    dto,
    getHeaders()
  );
  return res.data;
}