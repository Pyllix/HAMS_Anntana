import axios from "axios";
import type {
  RepairActionType,
  RepairAvailabilityCode,
  RepairAssetStatusCode,
  RepairJob,
  RepairJobStatusCode,
  RepairUser,
} from "../Types/TypeRepairWorkflow";

const BASE_URL = "https://hams-anntana.onrender.com";
const PAGE_SIZE = 100;
const DETAIL_BATCH_SIZE = 8;

interface ApiPaginationMeta {
  page: number;
  totalPages: number;
  hasNextPage: boolean;
}

interface ApiPaginatedResponse<T> {
  data: T[];
  meta: ApiPaginationMeta;
}

interface ApiUser {
  id: string;
  employeeId?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  section_id?: string | null;
}

interface ApiSection {
  id: string;
  code?: string | null;
  name?: string | null;
}

interface ApiAssetState {
  code?: string | null;
}

interface ApiAsset {
  id: string;
  noid?: string | null;
  name?: string | null;
  model?: string | null;
  serialNo?: string | null;
  section_id?: string | null;
  status?: ApiAssetState | null;
  availabilityStatus?: ApiAssetState | null;
}

interface ApiJobStatus {
  id: number;
  code: string;
  name: string;
}

interface ApiCause {
  id: number;
  code?: string | null;
  name?: string | null;
}

interface ApiCompany {
  id: string;
  code?: string | null;
  name?: string | null;
  tel?: string | null;
}

interface ApiStepMaster {
  id: number;
  stepNumber: number;
  actionType: string;
  label: string;
}

interface ApiRepairStep {
  id: number;
  jobId: string;
  stepMasterId: number;
  completeAt?: string | null;
  note?: string | null;
  completedBy?: string | null;
  stepMaster: ApiStepMaster;
  user?: ApiUser | null;
}

interface ApiMechanicRepair {
  id: number;
  jobId: string;
  createdAt: string;
  updatedAt: string;
  user: ApiUser;
}

interface ApiSparePart {
  id: number;
  code?: string | number | null;
  name?: string | null;
}

interface ApiSparePartTransaction {
  id: number;
  sparepartId: number;
  txnType: string;
  qty: number;
  unitPrice: number | string;
  txnDate?: string | null;
  createdAt?: string | null;
  txnBy?: string | null;
  sparepart?: ApiSparePart | null;
  user?: ApiUser | null;
}

export interface ApiRepairJob {
  id: string;
  jobNo: string;
  assetId: string;
  sectionId: string;
  reporterId: string;
  jobTypeId?: number | null;
  reportType?: string | null;
  jobStatusId?: number | null;
  companyId?: string | null;
  billNo?: string | null;
  symptom?: string | null;
  diagnosis?: string | null;
  solution?: string | null;
  causeId?: number | null;
  urgencyStatus?: string | null;
  dueDate?: string | null;
  returnDate?: string | null;
  isRepeatRepair?: boolean | null;
  techCategoryId?: number | null;
  receiverId?: string | null;
  warrantyDate?: string | null;
  createdAt: string;
  createdBy?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
  asset?: ApiAsset | null;
  section?: ApiSection | null;
  reporter?: ApiUser | null;
  receiver?: ApiUser | null;
  jobStatus?: ApiJobStatus | null;
  cause?: ApiCause | null;
  company?: ApiCompany | null;
  mechanicRepairs?: ApiMechanicRepair[];
  repairJobSteps?: ApiRepairStep[];
  sparepartTxns?: ApiSparePartTransaction[];
}

const repairActionTypes: RepairActionType[] = [
  "SELF_REPAIR",
  "INTERNAL_STOCK",
  "EXTERNAL_STOCK",
  "OUTSOURCE",
  "PURCHASE_REPLACEMENT",
];

const repairStatusCodes: RepairJobStatusCode[] = [
  "WAITING_HANDOVER",
  "PENDING_ASSIGN",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "PARCEL_PROCESSING",
  "OUTSOURCED",
  "UNREPAIRABLE",
  "WAITING_DELIVERY",
  "COMPLETED",
  "CANCELLED",
];

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

function isRepairActionType(value?: string | null): value is RepairActionType {
  return repairActionTypes.includes(value as RepairActionType);
}

function toRepairStatusCode(value?: string | null): RepairJobStatusCode {
  return repairStatusCodes.includes(value as RepairJobStatusCode)
    ? (value as RepairJobStatusCode)
    : "IN_PROGRESS";
}

function toAssetStatusCode(
  value?: string | null,
): RepairAssetStatusCode | undefined {
  return value === "UNDER_REPAIR" ||
    value === "NORMAL" ||
    value === "WAIT_DISPOSAL"
    ? value
    : undefined;
}

function toAvailabilityCode(
  value?: string | null,
): RepairAvailabilityCode | undefined {
  return value === "UNAVAILABLE" || value === "AVAILABLE" ? value : undefined;
}

function mapUser(
  user?: ApiUser | null,
  section?: ApiSection | null,
): RepairUser | undefined {
  if (!user?.id) return undefined;
  return {
    userId: user.id,
    employeeId: user.employeeId || undefined,
    firstName: user.firstname || "",
    lastName: user.lastname || "",
    sectionId: user.section_id || section?.id || undefined,
    sectionName: section?.name || undefined,
  };
}

function getWorkflowAction(job: ApiRepairJob): RepairActionType | null {
  const actionType = job.repairJobSteps?.[0]?.stepMaster?.actionType;
  return isRepairActionType(actionType) ? actionType : null;
}

function getCompletedStepNumber(steps: ApiRepairStep[]): number {
  return steps.reduce(
    (highest, step) =>
      step.completeAt ? Math.max(highest, step.stepMaster.stepNumber) : highest,
    0,
  );
}

function toDateOnly(value?: string | null): string {
  if (!value) return "";
  const matchedDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (matchedDate) return matchedDate;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function getWarrantyMonths(
  completedDate?: string | null,
  warrantyDate?: string | null,
): number {
  if (!completedDate || !warrantyDate) return 0;
  const completed = new Date(completedDate);
  const warranty = new Date(warrantyDate);
  if (
    Number.isNaN(completed.getTime()) ||
    Number.isNaN(warranty.getTime()) ||
    warranty <= completed
  ) {
    return 0;
  }

  const months =
    (warranty.getUTCFullYear() - completed.getUTCFullYear()) * 12 +
    warranty.getUTCMonth() -
    completed.getUTCMonth();
  return Math.max(0, months);
}

export function mapApiRepairJob(job: ApiRepairJob): RepairJob {
  const steps = job.repairJobSteps || [];
  const actionType = getWorkflowAction(job);
  const diagnosisBoundary = actionType === "SELF_REPAIR" ? 3 : 4;
  const diagnosisStep = [...steps]
    .reverse()
    .find(
      (step) =>
        step.stepMaster.stepNumber <= diagnosisBoundary && step.completeAt,
    );
  const finalStep = steps[steps.length - 1];
  const statusCode = toRepairStatusCode(job.jobStatus?.code);
  const reporter = mapUser(job.reporter, job.section);
  const receiver = mapUser(job.receiver, job.section);
  const evaluator =
    mapUser(diagnosisStep?.user, job.section) ||
    mapUser(job.mechanicRepairs?.[0]?.user, job.section);
  const completedDate = toDateOnly(job.returnDate || finalStep?.completeAt);
  const confirmedBy = mapUser(finalStep?.user, job.section) || receiver;

  return {
    jobId: job.id,
    jobNo: job.jobNo,
    assetId: job.assetId,
    sectionId: job.sectionId,
    reporterId: job.reporterId,
    jobTypeId: job.jobTypeId,
    reportType: job.reportType === "MAINTENANCE" ? "MAINTENANCE" : "REPAIR",
    jobStatusId: job.jobStatus?.id || job.jobStatusId || 0,
    companyId: job.companyId,
    billNo: job.billNo,
    symptom: job.symptom || "",
    diagnosis: job.diagnosis,
    solution: job.solution,
    causeId: job.causeId,
    actionType,
    urgencyStatus:
      job.urgencyStatus === "URGENT" || job.urgencyStatus === "EMERGENCY"
        ? job.urgencyStatus
        : "NORMAL",
    dueDate: job.dueDate,
    returnDate: job.returnDate,
    isRepeatRepair: Boolean(job.isRepeatRepair),
    techCategoryId: job.techCategoryId,
    receiverId: job.receiverId,
    createdAt: job.createdAt,
    createdBy: job.createdBy || "",
    updatedAt: job.updatedAt,
    updatedBy: job.updatedBy || "",
    evaluatedAt: diagnosisStep?.completeAt || null,
    workflowStep: getCompletedStepNumber(steps),
    readyForConfirmation: statusCode === "WAITING_DELIVERY",
    assetStatusCode: toAssetStatusCode(job.asset?.status?.code),
    availabilityStatusCode: toAvailabilityCode(
      job.asset?.availabilityStatus?.code,
    ),
    asset: job.asset
      ? {
          assetId: job.asset.id,
          assetCode: job.asset.noid || "-",
          assetName: job.asset.name || "-",
          model: job.asset.model || undefined,
          serialNumber: job.asset.serialNo || undefined,
          location: job.section?.name || undefined,
        }
      : undefined,
    section: job.section
      ? {
          sectionId: job.section.id,
          sectionCode: job.section.code || "",
          sectionName: job.section.name || "",
        }
      : undefined,
    reporter,
    evaluator,
    status: {
      jobStatusId: job.jobStatus?.id || job.jobStatusId || 0,
      statusCode,
      statusName: job.jobStatus?.name || statusCode,
    },
    cause: job.cause
      ? {
          causeId: job.cause.id,
          causeCode: job.cause.code || "",
          causeName: job.cause.name || "",
        }
      : undefined,
    company: job.company
      ? {
          companyId: job.company.id,
          companyCode: job.company.code || undefined,
          name: job.company.name || "",
          telephone: job.company.tel || undefined,
        }
      : null,
    mechanics: (job.mechanicRepairs || []).map((mechanic) => ({
      mechanicRepairId: mechanic.id,
      jobId: mechanic.jobId,
      user: mapUser(mechanic.user, job.section) || {
        userId: "",
        firstName: "",
        lastName: "",
      },
      createdAt: mechanic.createdAt,
      updatedAt: mechanic.updatedAt,
    })),
    steps: steps.map((step) => ({
      stepId: step.id,
      jobId: step.jobId,
      stepMasterId: step.stepMasterId,
      stepName: step.stepMaster.label,
      completedAt: step.completeAt,
    })),
    sparePartTransactions: (job.sparepartTxns || [])
      .filter(
        (transaction) =>
          transaction.txnType === "WITHDRAW" ||
          transaction.txnType === "RETURN",
      )
      .map((transaction) => ({
        transactionId: transaction.id,
        sparePartId: transaction.sparepartId,
        sparePartCode: String(transaction.sparepart?.code || "-"),
        sparePartName: transaction.sparepart?.name || "-",
        transactionType: transaction.txnType as "WITHDRAW" | "RETURN",
        quantity: transaction.qty,
        unitPrice: Number(transaction.unitPrice) || 0,
        transactionDate:
          transaction.txnDate || transaction.createdAt || job.updatedAt,
        transactionBy: mapUser(transaction.user, job.section) || {
          userId: transaction.txnBy || "",
          firstName: "",
          lastName: "",
        },
      })),
    confirmation:
      statusCode === "COMPLETED" && receiver && confirmedBy
        ? {
            completedDate,
            receiverId: receiver.userId,
            receiverName: `${receiver.firstName} ${receiver.lastName}`.trim(),
            warrantyMonths: getWarrantyMonths(
              job.returnDate || finalStep?.completeAt,
              job.warrantyDate,
            ),
            warrantyEndDate: job.warrantyDate || null,
            repairSummary: finalStep?.note || job.solution || "",
            confirmedBy,
            confirmedAt:
              finalStep?.completeAt || job.returnDate || job.updatedAt,
          }
        : null,
  };
}

function getPageData<T>(payload: ApiPaginatedResponse<T> | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.data || [];
}

export async function fetchRepairJobSummaries(
  params: Record<string, string | number | boolean> = {},
): Promise<ApiRepairJob[]> {
  const jobs: ApiRepairJob[] = [];
  let page = 1;
  let hasNextPage = false;

  do {
    const response = await axios.get<
      ApiPaginatedResponse<ApiRepairJob> | ApiRepairJob[]
    >(`${BASE_URL}/repairs`, {
      ...getHeaders(),
      params: { ...params, page, limit: PAGE_SIZE },
    });
    jobs.push(...getPageData(response.data));
    hasNextPage =
      !Array.isArray(response.data) && Boolean(response.data.meta?.hasNextPage);
    page += 1;
  } while (hasNextPage);

  return jobs;
}

export async function fetchRepairJobDetail(
  jobId: string,
): Promise<ApiRepairJob> {
  const response = await axios.get<ApiRepairJob>(
    `${BASE_URL}/repairs/${jobId}`,
    getHeaders(),
  );
  return response.data;
}

export async function fetchDetailedRepairJobs(
  summaries: ApiRepairJob[],
): Promise<ApiRepairJob[]> {
  const details: ApiRepairJob[] = [];
  for (let index = 0; index < summaries.length; index += DETAIL_BATCH_SIZE) {
    const batch = summaries.slice(index, index + DETAIL_BATCH_SIZE);
    details.push(
      ...(await Promise.all(batch.map((job) => fetchRepairJobDetail(job.id)))),
    );
  }
  return details;
}

export async function advanceNextRepairStep(
  jobId: string,
  body: { note?: string; receiverId?: string; warrantyDate?: string },
): Promise<ApiRepairJob> {
  const response = await axios.patch<{ job: ApiRepairJob } | ApiRepairJob>(
    `${BASE_URL}/repairs/${jobId}/steps/next`,
    body,
    getHeaders(),
  );
  return "job" in response.data ? response.data.job : response.data;
}

export async function fetchRepairReceivers(
  job: RepairJob,
): Promise<RepairUser[]> {
  const fallback = job.reporter ? [job.reporter] : [];
  if (!job.sectionId) return fallback;

  const response = await axios.get<ApiPaginatedResponse<ApiUser> | ApiUser[]>(
    `${BASE_URL}/users`,
    {
      ...getHeaders(),
      params: { section_id: job.sectionId, page: 1, limit: PAGE_SIZE },
    },
  );
  const section: ApiSection = {
    id: job.sectionId,
    code: job.section?.sectionCode,
    name: job.section?.sectionName,
  };
  const users = getPageData(response.data)
    .map((user) => mapUser(user, section))
    .filter((user): user is RepairUser => Boolean(user));

  for (const user of fallback) {
    if (!users.some((candidate) => candidate.userId === user.userId)) {
      users.push(user);
    }
  }

  return users.sort((left, right) =>
    `${left.firstName} ${left.lastName}`.localeCompare(
      `${right.firstName} ${right.lastName}`,
      "th",
    ),
  );
}

export function toRepairApiError(
  error: unknown,
  fallbackMessage: string,
): Error {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return new Error(message.join("\n"));
    if (typeof message === "string" && message.trim()) {
      return new Error(message);
    }
  }
  return error instanceof Error ? error : new Error(fallbackMessage);
}
