import { RepairConfirmationDto, RepairJob } from "../Types/TypeRepairWorkflow";
import {
  cloneRepairJobs,
  getRepairStatus,
  repairReceiverOptions,
  repairJobsMock,
} from "../mockData/repairJobData";

const MOCK_DELAY_MS = 180;

function waitForMockApi(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, MOCK_DELAY_MS));
}

function addMonths(dateString: string, months: number): string | null {
  if (months <= 0) return null;
  const date = new Date(`${dateString}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export async function getRepairConfirmations(): Promise<RepairJob[]> {
  await waitForMockApi();
  return cloneRepairJobs()
    .filter(
      (job) =>
        job.status?.statusCode === "WAITING_DELIVERY" ||
        job.status?.statusCode === "COMPLETED",
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

export async function getRepairConfirmationById(
  jobId: string,
): Promise<RepairJob> {
  await waitForMockApi();
  const job = cloneRepairJobs().find((item) => item.jobId === jobId);
  if (!job) throw new Error("ไม่พบข้อมูลงานซ่อมที่เลือก");
  return job;
}

export async function confirmRepair(
  dto: RepairConfirmationDto,
): Promise<RepairJob> {
  await waitForMockApi();
  const job = repairJobsMock.find((item) => item.jobId === dto.jobId);
  if (!job) throw new Error("ไม่พบข้อมูลงานซ่อมที่เลือก");

  const confirmedAt = new Date().toISOString();
  const confirmedBy = repairReceiverOptions.find(
    (receiver) => receiver.userId === dto.receiverId,
  ) || {
    userId: dto.receiverId,
    firstName: dto.receiverName,
    lastName: "",
  };

  job.confirmation = {
    completedDate: dto.completedDate,
    receiverId: dto.receiverId,
    receiverName: dto.receiverName,
    warrantyMonths: dto.warrantyMonths,
    warrantyEndDate: addMonths(dto.completedDate, dto.warrantyMonths),
    repairSummary: dto.repairSummary,
    confirmedBy,
    confirmedAt,
  };
  job.receiverId = dto.receiverId;
  job.returnDate = `${dto.completedDate}T00:00:00.000Z`;
  job.status = getRepairStatus("COMPLETED");
  job.jobStatusId = job.status.jobStatusId;
  job.workflowStep =
    job.actionType === "SELF_REPAIR"
      ? 6
      : job.actionType === "PURCHASE_REPLACEMENT"
        ? 10
        : 9;
  job.readyForConfirmation = false;
  job.assetStatusCode =
    job.actionType === "PURCHASE_REPLACEMENT" ? "WAIT_DISPOSAL" : "NORMAL";
  job.availabilityStatusCode =
    job.actionType === "PURCHASE_REPLACEMENT" ? "UNAVAILABLE" : "AVAILABLE";
  job.updatedAt = confirmedAt;
  job.updatedBy = confirmedBy.userId;

  return { ...job };
}
