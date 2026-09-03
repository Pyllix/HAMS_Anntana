export type PriorityFilter = "ALL" | "NORMAL" | "URGENT" | "EMERGENCY";

export type AssessmentTab = "PENDING" | "REPAIR_LIST" | "CONFIRM_REPAIR";

export type RepairReportType = "REPAIR" | "MAINTENANCE";

export type RepairActionType =
  | "SELF_REPAIR"
  | "INTERNAL_STOCK"
  | "EXTERNAL_STOCK"
  | "OUTSOURCE"
  | "PURCHASE_REPLACEMENT";

export type RepairJobStatusCode =
  | "WAITING_HANDOVER"
  | "PENDING_ASSIGN"
  | "IN_PROGRESS"
  | "WAITING_PARTS"
  | "PARCEL_PROCESSING"
  | "OUTSOURCED"
  | "UNREPAIRABLE"
  | "WAITING_DELIVERY"
  | "COMPLETED"
  | "CANCELLED";

export type RepairWorkflowActor =
  | "MAINTENANCE"
  | "SUPERVISOR"
  | "PARCEL"
  | "DEPARTMENT";

export type RepairAssetStatusCode = "UNDER_REPAIR" | "NORMAL" | "WAIT_DISPOSAL";

export type RepairAvailabilityCode = "UNAVAILABLE" | "AVAILABLE";

export interface RepairUser {
  userId: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  sectionId?: string;
  sectionName?: string;
}

export interface RepairSection {
  sectionId: string;
  sectionCode: string;
  sectionName: string;
}

export interface RepairCompany {
  companyId: string;
  companyCode?: string;
  name: string;
  telephone?: string;
}

export interface RepairAsset {
  assetId: string;
  assetCode: string;
  assetName: string;
  model?: string;
  serialNumber?: string;
  location?: string;
}

export interface RepairStatus {
  jobStatusId: number;
  statusCode: RepairJobStatusCode;
  statusName: string;
}

export interface RepairCause {
  causeId: number;
  causeCode: string;
  causeName: string;
}

export interface RepairSparePartTransaction {
  transactionId: number;
  sparePartId: number;
  sparePartCode: string;
  sparePartName: string;
  transactionType: "WITHDRAW" | "RETURN";
  quantity: number;
  unitPrice: number;
  transactionDate: string;
  transactionBy: RepairUser;
}

export interface RepairJobStep {
  stepId: number;
  jobId: string;
  stepMasterId: number;
  stepName: string;
  completedAt?: string | null;
}

export interface RepairMechanic {
  mechanicRepairId: number;
  jobId: string;
  user: RepairUser;
  createdAt: string;
  updatedAt: string;
}

export interface RepairConfirmation {
  completedDate: string;
  receiverId: string;
  receiverName: string;
  warrantyMonths: number;
  warrantyEndDate?: string | null;
  repairSummary: string;
  confirmedBy: RepairUser;
  confirmedAt: string;
}

export interface RepairJob {
  jobId: string;
  jobNo: string;
  assetId: string;
  sectionId: string;
  reporterId: string;
  jobTypeId?: number | null;
  reportType: RepairReportType;
  jobStatusId: number;
  companyId?: string | null;
  billNo?: string | null;
  symptom: string;
  diagnosis?: string | null;
  solution?: string | null;
  causeId?: number | null;
  actionType?: RepairActionType | null;
  urgencyStatus: Exclude<PriorityFilter, "ALL">;
  dueDate?: string | null;
  returnDate?: string | null;
  isRepeatRepair: boolean;
  techCategoryId?: number | null;
  receiverId?: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  evaluatedAt?: string | null;
  workflowStep?: number;
  readyForConfirmation?: boolean;
  assetStatusCode?: RepairAssetStatusCode;
  availabilityStatusCode?: RepairAvailabilityCode;
  asset?: RepairAsset;
  section?: RepairSection;
  reporter?: RepairUser;
  evaluator?: RepairUser;
  status?: RepairStatus;
  cause?: RepairCause;
  company?: RepairCompany | null;
  mechanics?: RepairMechanic[];
  steps?: RepairJobStep[];
  sparePartTransactions?: RepairSparePartTransaction[];
  confirmation?: RepairConfirmation | null;
}

export interface EvaluationDto {
  jobId: string;
  diagnosis: string;
  solution: string;
  causeId: number;
  actionType: RepairActionType;
  dueDate?: string | null;
  isRepeatRepair: boolean;
  techCategoryId: number;
  companyId?: string | null;
  billNo?: string | null;
  spareParts?: Array<{
    sparePartId: number;
    quantity: number;
  }>;
}

export interface RepairConfirmationDto {
  jobId: string;
  completedDate: string;
  receiverId: string;
  receiverName: string;
  warrantyMonths: number;
  repairSummary: string;
}

export type RepairActionFilter = "ALL" | RepairActionType;
export type RepairStatusFilter = "ALL" | RepairJobStatusCode;

export interface RepairWorkflowStage {
  stepNumber: number;
  stepLabel: string;
  actionLabel: string;
  description: string;
  actor: RepairWorkflowActor;
  nextStatus: RepairJobStatusCode;
}
