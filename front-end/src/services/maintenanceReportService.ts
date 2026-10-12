import { ROLES } from "../router/roles";
import type { User } from "../types/TypeUser";
import type { RepairJob } from "../types/TypeRepairWorkflow";
import {
  fetchDetailedRepairJobs,
  fetchRepairJobSummaries,
  mapApiRepairJob,
  toRepairApiError,
} from "./repairApiService";

export async function getMaintenanceReportJobs(): Promise<RepairJob[]> {
  try {
    const summaries = await fetchRepairJobSummaries();
    const details = await fetchDetailedRepairJobs(summaries);
    return details
      .map(mapApiRepairJob)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );
  } catch (error) {
    throw toRepairApiError(error, "ไม่สามารถโหลดข้อมูลงานสำหรับออกรายงานได้");
  }
}

export function getJobsVisibleToMaintenanceUser(
  jobs: RepairJob[],
  user: User | null,
): RepairJob[] {
  if (!user) return [];
  if (user.role === ROLES.MAINTENANCE_HEAD) return jobs;

  return jobs.filter((job) => {
    const assigned = (job.mechanics || []).some(
      (mechanic) => mechanic.user.userId === user.id,
    );
    const evaluated = job.evaluator?.userId === user.id;
    return assigned || evaluated;
  });
}
