import axios from "axios";
import type { UnrepairableJobDto } from "../types/TypeUnrepairableReceipt";

export interface TechnicianUnrepairableJob extends UnrepairableJobDto {
  symptom?: string | null;
  solution?: string | null;
  causeId?: number | null;
  jobTypeId?: number | null;
  techCategoryId?: number | null;
  isRepeatRepair?: boolean;
  mechanicRepairs?: { user?: { id: string; firstname?: string; lastname?: string } }[];
}

const api = axios.create({ baseURL: "https://hams-anntana.onrender.com", timeout: 30000 });
function config(signal?: AbortSignal) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  return { signal, headers: { Authorization: `Bearer ${token}` } };
}

export async function getTechnicianUnrepairableJob(id: string, signal?: AbortSignal): Promise<TechnicianUnrepairableJob> {
  const { data } = await api.get<TechnicianUnrepairableJob>(`/repairs/${encodeURIComponent(id)}`, config(signal));
  return data;
}

export function canHandOverUnrepairable(job: TechnicianUnrepairableJob): boolean {
  const steps = [...(job.repairJobSteps || [])].sort((a, b) => a.stepMaster.stepNumber - b.stepMaster.stepNumber);
  const next = steps.find((step) => !step.completeAt);
  return job.jobStatus?.code === "UNREPAIRABLE" && !!job.asset &&
    next?.stepMaster.actionType === "UNREPAIRABLE" && next.stepMaster.stepNumber === 5 &&
    [1, 2, 3, 4].every((number) => steps.some((step) => step.stepMaster.actionType === "UNREPAIRABLE" && step.stepMaster.stepNumber === number && !!step.completeAt));
}

export async function handOverUnrepairable(id: string, note: string): Promise<void> {
  const job = await getTechnicianUnrepairableJob(id);
  if (!canHandOverUnrepairable(job)) throw new Error("งานนี้ไม่อยู่ในขั้นรอช่างส่งคืน อาจส่งคืนแล้วหรือสถานะเปลี่ยนไป กรุณาโหลดข้อมูลใหม่");
  await api.patch(`/repairs/${encodeURIComponent(id)}/steps/next`, { note: note.trim() || "ช่างนำส่งครุภัณฑ์ให้พัสดุเรียบร้อย" }, config());
}
