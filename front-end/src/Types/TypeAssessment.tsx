import type { User } from "../types/TypeUser";

// ─── Enums & Literals

export type UrgencyStatus = "NORMAL" | "URGENT" | "EMERGENCY";
export type PriorityFilter = "ALL" | UrgencyStatus;
export type AssessmentTab = "PENDING" | "REPAIR_LIST" | "CONFIRM_REPAIR";

export type ActionTypeUI =
  | "ซ่อมเองได้"
  | "ขอเบิกอะไหล่ภายใน"
  | "ขอเบิกอะไหล่ภายนอก"
  | "ส่งซ่อมภายนอก"
  | "ขอซื้อทดแทน";

export type ActionType = ActionTypeUI;

// ─── Entities (Master Data)

export interface Asset {
  assetId: number;
  assetCode: string;
  assetName: string;
}

export interface RepairCause {
  causeId: number;
  causeCode: string;
  causeName: string;
}

export interface TechCategory {
  techCategoryId: number;
  categoryCode: string;
  categoryName: string;
  isActive: number;
}

export interface Company {
  id: string;
  code: string;
  name: string;
  tel: string;
  email: string;
  address: string;
  fax: string;
  group: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface SparePart {
  sparepartId: string | number;
  sparepartCode: number;
  name: string;
  unit: string;
  price: number;
  minStock?: number;
  qtyInStock: number;
  groupId?: number;
}

export interface SelectedSparePart extends SparePart {
  quantity: number;
}

// ─── Main Model

export interface RepairJob {
  jobId: number;
  jobNo: string;
  assetId: number;
  sectionId?: number;
  reporterId?: number;
  jobTypeId?: number;
  reportType?: string;
  jobStatusId?: number;
  companyId?: number;
  billNo?: string;
  symptom: string;
  diagnosis?: string;
  solution?: string;
  causeId?: number;
  urgencyStatus: UrgencyStatus;
  dueDate?: string;
  returnDate?: string;
  isRepeatRepair?: boolean;
  techCategoryId?: number;
  receiverId?: number;
  createdAt: string;
  createdBy?: number;
  updatedAt?: string;
  updatedBy?: number;

  asset?: Asset;
  cause?: RepairCause;
  techCategory?: TechCategory;
  company?: Company;
  assignees?: User[];
}

// ─── Form State (สำหรับผูกข้อมูลฟอร์มประเมินของช่าง) ─────────────────────────

export interface AssessmentFormState {
  symptomCause?: string;
  solution?: string;
  causeCategory?: string;
  causeId?: number;
  isRepeat?: boolean;
  isRepeatRepair?: boolean;
  estimatedDays?: number | string;
  technicalDiagnosis?: string;
  dueDate?: string;
  vendorId?: string | number;
  companyId?: number;
  techCategoryId?: number;
  assigneeIds?: (string | number)[];
  spares?: SelectedSparePart[];
  [key: string]: any;
}

export interface EvaluationSpareDto {
  sparepartId: number;
  qty: number;
  unitPrice: number;
}

export interface EvaluationDto {
  jobId: number;
  actionType: ActionTypeUI;
  symptomCause?: string;
  diagnosis?: string;
  solution?: string;
  causeCategory?: string;
  causeId?: number;
  isRepeatRepair?: boolean;
  dueDate?: string;
  technicalDiagnosis?: string;
  assigneeIds: string[];
  vendorId?: string | number;
  companyId?: number;
  techCategoryId?: number;
  spares?: EvaluationSpareDto[];
}
