export type PriorityFilter = "ALL" | UrgencyStatus;
export type AssessmentTab = "PENDING" | "REPAIR_LIST" | "CONFIRM_REPAIR";

export type StepActionType =
  | "SELF_REPAIR" // ซ่อมเองได้
  | "INTERNAL_STOCK" // ขอเบิกอะไหล่ภายใน
  | "EXTERNAL_STOCK" // ขอเบิกอะไหล่ภายนอก
  | "OUTSOURCE" // ส่งซ่อมภายนอก
  | "PURCHASE_REPLACEMENT"; // ขอซื้อทดแทน

export type UrgencyStatus = "NORMAL" | "URGENT" | "EMERGENCY";

export interface BaseLookup {
  id: number;
  code?: string;
  name: string;
}

export interface Company {
  id: string;
  name: string;
}

export interface SparePart {
  id: string;
  code: string;
  name: string;
  qtyInStock: number;
  price: number;
  unit: string;
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
  section?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface RepairMetaLookups {
  jobStatuses: BaseLookup[];
  jobTypes: BaseLookup[];
  causes: BaseLookup[];
}

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

export interface RepairDetail {
  id: string;
  jobNo: string;
  assetId?: string;
  sectionId?: string;
  reporterId?: string;
  jobTypeId?: number;
  reportType?: string;
  jobStatusId?: number;
  companyId?: string | null;
  diagnosis?: string | null;
  symptom?: string;
  solution?: string;
  causeId?: number;
  actionType?: string;
  urgencyStatus?: UrgencyStatus;
  dueDate?: string;
  returnDate?: string | null;
  isRepeatRepair?: boolean;
  techCategoryId?: number;
  createdAt?: string;
  updatedAt?: string;
  
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

  section?: {
    id: string;
    code?: string;
    name?: string;
    tel?: string;
    building?: string;
  };

  reporter?: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    employeeId?: string;
  };

  mechanicRepairs?: Array<{
    id: number;
    userId: string;
    user?: Mechanic;
  }>;

  sparepartTxns?: Array<{
    id: number;
    sparepartId: number;
    qty: number;
    unitPrice: string;
    sparepart?: {
      id: number;
      code: string;
      name: string;
      unit: string;
      price: string;
      qtyInStock: number;
    };
  }>;

  savedEvaluation?: RepairDetailDto | null;
}

export interface RepairDetailDto {
  stepActionType: StepActionType;
  actionType?: string;
  techCategoryId?: number;
  jobTypeId?: number;
  symptomCause?: string;
  diagnosis?: string;
  solution: string;
  causeId: number;
  isRepeatRepair: boolean;
  dueDate: string;
  technicalDiagnosisDetail?: string;
  mechanicIds: string[];
  companyId?: string | null;
  spareParts?: Array<{
    sparepartId: number;
    qty: number;
  }>;
}
