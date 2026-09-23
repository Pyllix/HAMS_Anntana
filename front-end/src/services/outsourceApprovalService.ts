import axios from "axios";
import type {
  OutsourceApprovalDecision,
  OutsourceApprovalRequest,
  OutsourceRejectionDecision,
} from "../Types/TypeOutsourceApproval";
import type { ApiRepairJob } from "./repairApiService";

const BASE_URL = "https://hams-anntana.onrender.com";
const api = axios.create({ baseURL: BASE_URL, timeout: 30000 });

function config(signal?: AbortSignal) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("กรุณาเข้าสู่ระบบใหม่ก่อนทำรายการ");
  return { signal, headers: { Authorization: `Bearer ${token}` } };
}

function requestNo(jobNo: string): string {
  return `OUT-${jobNo.replace(/^[A-Z]+-/, "")}`;
}

function mapRequest(job: ApiRepairJob): OutsourceApprovalRequest | null {
  const steps = job.repairJobSteps || [];
  if (steps[0]?.stepMaster?.actionType !== "OUTSOURCE") return null;

  const completedStep = steps.reduce(
    (highest, step) =>
      step.completeAt ? Math.max(highest, step.stepMaster.stepNumber) : highest,
    0,
  );
  const approvalStep = steps.find((step) => step.stepMaster.stepNumber === 5);
  const mechanic = job.mechanicRepairs?.[0]?.user;
  const isRejected =
    job.isRejected || approvalStep?.note?.startsWith("[ไม่อนุมัติ]");

  if (completedStep !== 4 || isRejected) return null;

  return {
    id: job.id,
    requestNo: requestNo(job.jobNo),
    requestedAt: job.updatedAt,
    jobNo: job.jobNo,
    assetCode: job.asset?.noid || "-",
    assetName: job.asset?.name || "-",
    assetModel: job.asset?.model || "-",
    serialNumber: job.asset?.serialNo || "-",
    imageUrl: job.asset?.imageUrl || null,
    requester: mechanic
      ? `${mechanic.firstname || ""} ${mechanic.lastname || ""}`.trim() ||
        "ไม่ระบุชื่อช่าง"
      : "ไม่ระบุชื่อช่าง",
    requesterSection: job.section?.name || "ฝ่ายซ่อมบำรุง",
    symptom: job.symptom || "-",
    diagnosis: job.diagnosis || "-",
    solution: job.solution || "-",
    dueDate: job.dueDate || null,
    statusCode: job.jobStatus?.code || "",
    workflowStep: completedStep,
  };
}

async function getOutsourceJobIds(signal?: AbortSignal): Promise<string[]> {
  const ids = new Set<string>();
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<{
      data: Array<{ id: string }>;
      meta: { totalPages: number };
    }>("/repairs", {
      ...config(signal),
      params: { page, limit: 100, stepActionType: "OUTSOURCE" },
    });
    if (!Array.isArray(data.data)) {
      throw new Error("รูปแบบข้อมูลคำขอส่งซ่อมภายนอกไม่ตรงกับ API");
    }
    data.data.forEach((job) => ids.add(job.id));
    if (page >= (data.meta?.totalPages || 1) || data.data.length === 0) break;
  }
  return [...ids];
}

export async function getOutsourceApprovalRequests(
  signal?: AbortSignal,
): Promise<OutsourceApprovalRequest[]> {
  const ids = await getOutsourceJobIds(signal);
  const requests: OutsourceApprovalRequest[] = [];

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
      if (request) requests.push(request);
    });
  }

  return requests.sort(
    (left, right) => Date.parse(right.requestedAt) - Date.parse(left.requestedAt),
  );
}

export async function approveOutsourceRequest(
  id: string,
  decision: OutsourceApprovalDecision,
): Promise<void> {
  const companyId = decision.companyId.trim();
  const billNo = decision.billNo.trim();
  if (!companyId) throw new Error("กรุณาเลือกบริษัทที่รับซ่อม");
  if (!billNo) throw new Error("กรุณาระบุเลขที่ใบสั่งจ้างหรือเอกสารอ้างอิง");
  if (!Number.isFinite(decision.repairCost) || decision.repairCost < 0) {
    throw new Error("กรุณาระบุค่าซ่อมเป็นจำนวนตั้งแต่ 0 บาทขึ้นไป");
  }

  await api.patch(
    `/repairs/${encodeURIComponent(id)}/steps/next`,
    {
      companyId,
      billNo,
      repairCost: decision.repairCost,
      note:
        decision.note?.trim() ||
        "เจ้าหน้าที่พัสดุอนุมัติส่งซ่อมบริษัทภายนอกแล้ว",
    },
    config(),
  );
}

export async function rejectOutsourceRequest(
  id: string,
  decision: OutsourceRejectionDecision,
): Promise<void> {
  const reason = decision.reason.trim();
  if (!reason) throw new Error("กรุณาระบุเหตุผลที่ปฏิเสธการส่งซ่อมภายนอก");
  await api.patch(
    `/repairs/${encodeURIComponent(id)}/steps/reject`,
    { reason },
    config(),
  );
}

export function outsourceApprovalError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
    if (error.response?.status === 403) {
      return "บัญชีนี้ไม่มีสิทธิ์อนุมัติส่งซ่อมภายนอก กรุณาใช้บัญชีเจ้าหน้าที่พัสดุ";
    }
    const message: unknown = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(" / ");
    if (typeof message === "string") return message;
    return "ไม่สามารถทำรายการได้ กรุณารีเฟรชและลองใหม่";
  }
  return error instanceof Error
    ? error.message
    : "ไม่สามารถทำรายการได้ กรุณาลองใหม่";
}
