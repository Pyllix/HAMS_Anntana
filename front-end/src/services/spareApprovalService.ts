import axios from "axios";
import type {
  SpareApprovalDecision,
  SpareApprovalRequest,
  SpareRejectionDecision,
} from "../Types/TypeSpareApproval";
import type { ApiRepairJob } from "./repairApiService";

const BASE_URL = "https://hams-anntana.onrender.com";
const api = axios.create({ baseURL: BASE_URL, timeout: 30000 });

function config(signal?: AbortSignal) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("กรุณาเข้าสู่ระบบใหม่ก่อนทำรายการ");
  return { signal, headers: { Authorization: `Bearer ${token}` } };
}

function requestNo(jobNo: string): string {
  return `REQ-${jobNo.replace(/^[A-Z]+-/, "")}`;
}

function mapRequest(job: ApiRepairJob): SpareApprovalRequest | null {
  const steps = job.repairJobSteps || [];
  const workflowAction = steps[0]?.stepMaster?.actionType;
  if (workflowAction !== "WITH_PARTS") return null;

  const parts = (job.sparepartTxns || [])
    .filter((transaction) => transaction.txnType === "PENDING_WITHDRAW")
    .map((transaction) => ({
      id: transaction.sparepartId,
      code: String(transaction.sparepart?.code || "-"),
      name: transaction.sparepart?.name || "ไม่ระบุชื่ออะไหล่",
      quantity: transaction.qty,
      unitPrice: Number(transaction.unitPrice) || 0,
      source:
        transaction.stockType === "EXTERNAL" ? "EXTERNAL" as const : "INTERNAL" as const,
      stockRemaining: transaction.sparepart?.qtyInStock ?? undefined,
      unit: transaction.sparepart?.unit || undefined,
    }));

  const completedSteps = steps.filter((step) => Boolean(step.completeAt));
  const workflowStep = completedSteps.reduce(
    (highest, step) => Math.max(highest, step.stepMaster.stepNumber),
    0,
  );
  const approvalStep = steps.find((step) => step.stepMaster.stepNumber === 5);
  const mechanic = job.mechanicRepairs?.[0]?.user;
  const requestedAt =
    job.sparepartTxns?.find((transaction) => transaction.txnType === "PENDING_WITHDRAW")
      ?.createdAt || job.updatedAt;

  return {
    id: job.id,
    requestNo: requestNo(job.jobNo),
    requestedAt,
    jobNo: job.jobNo,
    assetCode: job.asset?.noid || "-",
    assetName: job.asset?.name || "-",
    assetModel: job.asset?.model || "-",
    imageUrl: job.asset?.imageUrl || null,
    requester: mechanic
      ? `${mechanic.firstname || ""} ${mechanic.lastname || ""}`.trim() || "ไม่ระบุชื่อช่าง"
      : "ไม่ระบุชื่อช่าง",
    requesterSection: job.section?.name || "ฝ่ายซ่อมบำรุง",
    diagnosis: job.diagnosis || "-",
    solution: job.solution || "-",
    statusCode: job.jobStatus?.code || "",
    workflowStep,
    parts,
    rejectionReason: approvalStep?.note?.startsWith("[ไม่อนุมัติ]")
      ? approvalStep.note.replace(/^\[ไม่อนุมัติ\]\s*/, "")
      : undefined,
  };
}

async function getAllWithPartsIds(signal?: AbortSignal): Promise<string[]> {
  const ids = new Set<string>();
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<{
      data: Array<{ id: string }>;
      meta: { totalPages: number };
    }>("/repairs", {
      ...config(signal),
      params: { page, limit: 100, stepActionType: "WITH_PARTS" },
    });
    if (!Array.isArray(data.data)) {
      throw new Error("รูปแบบข้อมูลคำขอเบิกอะไหล่ไม่ตรงกับ API");
    }
    data.data.forEach((job) => ids.add(job.id));
    if (page >= (data.meta?.totalPages || 1) || data.data.length === 0) break;
  }
  return [...ids];
}

export async function getSpareApprovalRequests(
  signal?: AbortSignal,
): Promise<SpareApprovalRequest[]> {
  const ids = await getAllWithPartsIds(signal);
  const requests: SpareApprovalRequest[] = [];
  for (let offset = 0; offset < ids.length; offset += 6) {
    const batch = await Promise.all(
      ids.slice(offset, offset + 6).map(async (id) => {
        const { data } = await api.get<ApiRepairJob>(
          `/repairs/${encodeURIComponent(id)}`,
          config(signal),
        );
        return mapRequest(data);
      }),
    );
    batch.forEach((request) => {
      if (
        request &&
        request.workflowStep === 4 &&
        request.statusCode !== "PENDING_ASSIGN" &&
        request.parts.length > 0
      ) {
        requests.push(request);
      }
    });
  }
  return requests.sort(
    (left, right) => Date.parse(right.requestedAt) - Date.parse(left.requestedAt),
  );
}

export async function approveSpareRequest(
  id: string,
  decision: SpareApprovalDecision,
): Promise<void> {
  await api.patch(
    `/repairs/${encodeURIComponent(id)}/steps/next`,
    { note: decision.note?.trim() || "เจ้าหน้าที่พัสดุอนุมัติการเบิกอะไหล่แล้ว" },
    config(),
  );
}

export async function rejectSpareRequest(
  id: string,
  decision: SpareRejectionDecision,
): Promise<void> {
  const reason = decision.reason.trim();
  if (!reason) throw new Error("กรุณาระบุเหตุผลที่ปฏิเสธคำขอเบิกอะไหล่");
  await api.patch(
    `/repairs/${encodeURIComponent(id)}/steps/reject`,
    { reason },
    config(),
  );
}

export function spareApprovalError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
    if (error.response?.status === 403) {
      return "บัญชีนี้ไม่มีสิทธิ์อนุมัติการเบิกอะไหล่ กรุณาใช้บัญชีเจ้าหน้าที่พัสดุ";
    }
    const message: unknown = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(" / ");
    if (typeof message === "string") return message;
    return "ไม่สามารถทำรายการได้ กรุณารีเฟรชและลองใหม่";
  }
  return error instanceof Error ? error.message : "ไม่สามารถทำรายการได้ กรุณาลองใหม่";
}
