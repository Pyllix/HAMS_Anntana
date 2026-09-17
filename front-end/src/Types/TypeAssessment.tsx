export type UrgencyStatus = "NORMAL" | "URGENT" | "EMERGENCY";

export type PriorityFilter = "ALL" | UrgencyStatus;

export type AssessmentTab = "PENDING" | "REPAIR_LIST" | "CONFIRM_REPAIR";

export type StepActionType =
  | "SELF_REPAIR"   
  | "WITH_PARTS"    
  | "OUTSOURCE"    
  | "UNREPAIRABLE"; 

export type StockType = "INTERNAL" | "EXTERNAL";

export type ReportType = "Repair" | "Maintenance";

// REQUEST DTOs
export interface AssignMechanicDto {
  techCategoryId: number;
  mechanicIds: string[];
}

export interface SparePartItemDto {
  sparepartId: number;
  qty: number;
  stockType: StockType;
}

export interface DiagnoseDto {
  diagnosis: string;
  solution: string;
  causeId: number;
  techCategoryId: number;
  jobTypeId: number;
  actionType: string;
  stepActionType: StepActionType;
  dueDate: string;
  isRepeatRepair: boolean;
  unrepairableReason?: string;
  spareParts?: SparePartItemDto[];
}

export interface AdvanceStepDto {
  note?: string;
  companyId?: string;
  billNo?: string;
  repairCost?: number;
  receiverId?: string;
  warrantyDate?: string;
}

export interface RejectStepDto {
  reason: string;
}

export interface CompleteUnrepairableDto {
  storageLocation: string;
  note: string;
}

export interface CancelRepairDto {
  reason: string;
}

export interface ReturnSparePartDto {
  sparepartId: number;
  qty: number;
}

// MASTER & LOOKUP TYPES
export interface BaseLookup {
  id: number;
  code?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export type LookupCause = BaseLookup;
export type LookupJobType = BaseLookup;

export interface LookupTechCategory extends BaseLookup {
  isActive?: boolean;
}

export interface StepMaster {
  id: number;
  stepNumber: number;
  actionType: StepActionType;
  label: string;
}

export interface RepairMetaLookups {
  jobStatuses?: BaseLookup[];
  jobTypes: BaseLookup[];
  causes: BaseLookup[];
  techCategories: LookupTechCategory[];
  stepMasters?: StepMaster[];
}

export interface Section {
  id: string;
  name: string;
  code: string;
  tel?: string;
  building?: string;
}

export interface UserBasicInfo {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  employeeId?: string;
}

export interface Mechanic {
  id: string;
  employeeId: string;
  userName: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  imageUrl: string | null;
  sectionId?: string;
  section?: Section;
  activeJobsCount?: number;
}

export interface SparePart {
  id: number;
  code: string;
  name: string;
  qtyInStock: number;
  price: number;
  unit: string;
  minStock?: number;
  groupId?: number;
}

// REPAIR MODELS & RESPONSES
export interface RepairListItem {
  id: string;
  jobNo: string;
  symptom: string;
  urgencyStatus: UrgencyStatus;
  createdAt: string;
  asset?: {
    id: string;
    name: string;
    noid: string;
    type?: {
      id: number;
      name: string;
    };
  };
}

export interface MechanicRepair {
  id: number;
  jobId?: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  user?: Mechanic | UserBasicInfo;
}

export interface RepairJobStep {
  id: number;
  jobId: string;
  stepMasterId: number;
  completeAt: string;
  note: string | null;
  completedBy: string;
  stepMaster: StepMaster;
  user: UserBasicInfo;
}

export interface SparePartTransaction {
  id: number;
  sparepartId: number;
  jobId?: string;
  qty: number;
  unitPrice: number;
  txnType?: string;
  stockType?: StockType;
  txnDate?: string;
  txnBy?: string;
  createdAt?: string;
  sparepart?: SparePart;
  user?: UserBasicInfo;
}

export interface RepairSummary {
  outsourceCost: number;
  totalSparePartsCost: number;
  totalCost: number;
  totalSteps: number;
  completedSteps: number;
  isOverdue: boolean;
  overdueDays: number;
}

export interface RepairDetail {
  id: string;
  jobNo: string;
  assetId?: string;
  sectionId?: string;
  reporterId?: string;
  jobTypeId?: number;
  reportType?: ReportType;
  jobStatusId?: number;
  companyId?: string | null;
  billNo?: string | null;
  diagnosis?: string | null;
  symptom?: string;
  solution?: string;
  causeId?: number;
  actionType?: string;
  stepActionType?: StepActionType;
  urgencyStatus?: UrgencyStatus;
  dueDate?: string | null;
  returnDate?: string | null;
  isRepeatRepair?: boolean;
  techCategoryId?: number;
  receiverId?: string | null;
  warrantyDate?: string | null;
  unrepairableReason?: string | null;
  repairCost?: number | null;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;

  status?: {
    id?: number;
    code?: string;
    label?: string;
    name?: string;
  };

  asset?: {
    id: string;
    noid: string;
    name: string;
    model?: string;
    serialNo?: string;
    budgetType?: string;
    acqType?: string;
    price?: string;
    warrantyDate?: string;
    riskLevel?: string;
    remark?: string;
    imageUrl?: string;
    type?: {
      id: number;
      name: string;
    };
  };

  section?: Section;
  reporter?: UserBasicInfo;
  creator?: UserBasicInfo;
  updater?: UserBasicInfo;
  receiver?: UserBasicInfo | null;
  jobType?: BaseLookup;
  cause?: BaseLookup;
  techCategory?: LookupTechCategory;

  mechanicRepairs?: MechanicRepair[];
  repairJobSteps?: RepairJobStep[];
  sparepartTxns?: SparePartTransaction[];

  isOverdue?: boolean;
  overdueDays?: number;
  summary?: RepairSummary;

  savedEvaluation?: DiagnoseDto | null;
}