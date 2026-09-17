import type {
  RepairJob,
  RepairWorkflowStage,
} from "../Types/TypeRepairWorkflow";
import { getNextWorkflowStage } from "../config/repairWorkflow";
import {
  advanceNextRepairStep,
  fetchDetailedRepairJobs,
  fetchRepairJobDetail,
  fetchRepairJobSummaries,
  mapApiRepairJob,
  toRepairApiError,
} from "./repairApiService";

export async function getRepairHistory(): Promise<RepairJob[]> {
  try {
    const summaries = await fetchRepairJobSummaries();
    const evaluatedJobs = summaries.filter((job) => Boolean(job.diagnosis));
    const details = await fetchDetailedRepairJobs(evaluatedJobs);
    return details
      .map(mapApiRepairJob)
      .sort(
        (a, b) =>
          new Date(b.evaluatedAt || b.updatedAt).getTime() -
          new Date(a.evaluatedAt || a.updatedAt).getTime(),
      );
  } catch (error) {
    throw toRepairApiError(error, "ไม่สามารถโหลดรายการงานซ่อมได้");
  }
}

export async function getRepairHistoryById(jobId: string): Promise<RepairJob> {
  try {
    return mapApiRepairJob(await fetchRepairJobDetail(jobId));
  } catch (error) {
    throw toRepairApiError(error, "ไม่พบข้อมูลงานซ่อมที่เลือก");
  }
}

export async function advanceRepairWorkflow(
  jobId: string,
  requestedStage: RepairWorkflowStage,
): Promise<RepairJob> {
  try {
    const currentJob = mapApiRepairJob(await fetchRepairJobDetail(jobId));
    const nextStage = getNextWorkflowStage(currentJob);
    if (!nextStage || nextStage.stepNumber !== requestedStage.stepNumber) {
      throw new Error("ขั้นตอนของงานมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่");
    }

    return mapApiRepairJob(await advanceNextRepairStep(jobId, {}));
  } catch (error) {
    throw toRepairApiError(error, "ไม่สามารถอัปเดตขั้นตอนงานได้");
  }
}
