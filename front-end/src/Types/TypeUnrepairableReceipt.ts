export interface ReceiptUser {
  id: string;
  firstname?: string | null;
  lastname?: string | null;
}

export interface UnrepairableJobDto {
  id: string;
  jobNo: string;
  unrepairableReason?: string | null;
  diagnosis?: string | null;
  jobStatus?: { code: string } | null;
  asset?: {
    id: string;
    noid?: string | null;
    name?: string | null;
    model?: string | null;
    serialNo?: string | null;
    imageUrl?: string | null;
    type?: { id: string | number; name: string } | null;
  } | null;
  techCategory?: { name?: string | null } | null;
  repairJobSteps?: {
    completeAt?: string | null;
    note?: string | null;
    user?: ReceiptUser | null;
    stepMaster: { stepNumber: number; actionType: string };
  }[];
}

export interface UnrepairableReceipt {
  id: string;
  jobNo: string;
  assetCode: string;
  assetName: string;
  model: string;
  serialNo: string;
  imageUrl: string | null;
  category: string;
  sender: string;
  technicianCategory: string;
  sentAt: string;
  reason: string;
  diagnosis: string;
  handoverNote: string;
}

export interface ConfirmUnrepairableReceiptDto {
  storageLocation: string;
  note?: string;
}
