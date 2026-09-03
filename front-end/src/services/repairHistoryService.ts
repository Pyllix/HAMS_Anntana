import { RepairJob, RepairWorkflowStage } from "../Types/TypeRepairWorkflow";
import { getNextWorkflowStage } from "../config/repairWorkflow";
import {
  cloneRepairJobs,
  getRepairStatus,
  repairJobsMock,
} from "../mockData/repairJobData";

const MOCK_DELAY_MS = 180;

function waitForMockApi(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, MOCK_DELAY_MS));
}

export async function getRepairHistory(): Promise<RepairJob[]> {
  await waitForMockApi();
  return cloneRepairJobs().sort(
    (a, b) =>
      new Date(b.evaluatedAt || b.updatedAt).getTime() -
      new Date(a.evaluatedAt || a.updatedAt).getTime(),
  );
}

export async function getRepairHistoryById(jobId: string): Promise<RepairJob> {
  await waitForMockApi();
  const job = cloneRepairJobs().find((item) => item.jobId === jobId);
  if (!job) throw new Error("ไม่พบข้อมูลงานซ่อมที่เลือก");
  return job;
}

export async function advanceRepairWorkflow(
  jobId: string,
  requestedStage: RepairWorkflowStage,
): Promise<RepairJob> {
  await waitForMockApi();
  const job = repairJobsMock.find((item) => item.jobId === jobId);
  if (!job) throw new Error("ไม่พบข้อมูลงานซ่อมที่เลือก");

  const nextStage = getNextWorkflowStage(job);
  if (!nextStage || nextStage.stepNumber !== requestedStage.stepNumber) {
    throw new Error("ขั้นตอนของงานมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่");
  }

  const completedAt = new Date().toISOString();
  job.workflowStep = nextStage.stepNumber;
  job.status = getRepairStatus(nextStage.nextStatus);
  job.jobStatusId = job.status.jobStatusId;
  job.readyForConfirmation = nextStage.nextStatus === "WAITING_DELIVERY";
  job.updatedAt = completedAt;
  job.steps = [
    ...(job.steps || []).filter(
      (step) => step.stepMasterId !== nextStage.stepNumber,
    ),
    {
      stepId: Number(`${job.jobStatusId}${nextStage.stepNumber}`),
      jobId: job.jobId,
      stepMasterId: nextStage.stepNumber,
      stepName: nextStage.stepLabel,
      completedAt,
    },
  ];

  return { ...job };
}
