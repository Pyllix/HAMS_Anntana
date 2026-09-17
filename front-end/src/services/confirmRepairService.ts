import type {
  RepairConfirmationDto,
  RepairJob,
  RepairUser,
} from "../Types/TypeRepairWorkflow";
import {
  advanceNextRepairStep,
  fetchDetailedRepairJobs,
  fetchRepairJobDetail,
  fetchRepairJobSummaries,
  fetchRepairReceivers,
  mapApiRepairJob,
  toRepairApiError,
} from "./repairApiService";

function addMonths(dateString: string, months: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + Math.max(0, months));
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return date.toISOString().slice(0, 10);
}

export async function getRepairConfirmations(): Promise<RepairJob[]> {
  try {
    const [waitingJobs, completedJobs] = await Promise.all([
      fetchRepairJobSummaries({ statusCode: "WAITING_DELIVERY" }),
      fetchRepairJobSummaries({ statusCode: "COMPLETED" }),
    ]);
    const summaries = [...waitingJobs, ...completedJobs].filter(
      (job, index, jobs) =>
        jobs.findIndex((item) => item.id === job.id) === index,
    );
    const details = await fetchDetailedRepairJobs(summaries);
    return details
      .map(mapApiRepairJob)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  } catch (error) {
    throw toRepairApiError(error, "ไม่สามารถโหลดรายการยืนยันการซ่อมได้");
  }
}

export async function getRepairConfirmationById(
  jobId: string,
): Promise<RepairJob> {
  try {
    return mapApiRepairJob(await fetchRepairJobDetail(jobId));
  } catch (error) {
    throw toRepairApiError(error, "ไม่พบข้อมูลงานซ่อมที่เลือก");
  }
}

export async function getRepairReceivers(
  job: RepairJob,
): Promise<RepairUser[]> {
  try {
    return await fetchRepairReceivers(job);
  } catch (error) {
    if (job.reporter) return [job.reporter];
    throw toRepairApiError(error, "ไม่สามารถโหลดรายชื่อผู้รับมอบได้");
  }
}

export async function confirmRepair(
  dto: RepairConfirmationDto,
): Promise<RepairJob> {
  try {
    const job = mapApiRepairJob(await fetchRepairJobDetail(dto.jobId));
    if (job.status?.statusCode !== "WAITING_DELIVERY") {
      throw new Error("งานนี้ไม่ได้อยู่ในสถานะรอตรวจรับ กรุณาโหลดข้อมูลใหม่");
    }

    const updatedJob = await advanceNextRepairStep(dto.jobId, {
      receiverId: dto.receiverId,
      warrantyDate: addMonths(dto.completedDate, dto.warrantyMonths),
      note: dto.repairSummary,
    });
    return mapApiRepairJob(updatedJob);
  } catch (error) {
    throw toRepairApiError(error, "ไม่สามารถบันทึกผลตรวจรับได้");
  }
}
