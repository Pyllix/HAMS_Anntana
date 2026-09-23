export interface OutsourceApprovalRequest {
  id: string;
  requestNo: string;
  requestedAt: string;
  jobNo: string;
  assetCode: string;
  assetName: string;
  assetModel: string;
  serialNumber: string;
  imageUrl: string | null;
  requester: string;
  requesterSection: string;
  symptom: string;
  diagnosis: string;
  solution: string;
  dueDate: string | null;
  statusCode: string;
  workflowStep: number;
}

export interface OutsourceApprovalDecision {
  companyId: string;
  billNo: string;
  repairCost: number;
  note?: string;
}

export interface OutsourceRejectionDecision {
  reason: string;
}
