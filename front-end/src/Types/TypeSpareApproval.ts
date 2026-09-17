export type SpareSource = "INTERNAL" | "EXTERNAL";

export interface SpareApprovalPart {
  id: number;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  source: SpareSource;
  stockRemaining?: number;
  unit?: string;
}

export interface SpareApprovalRequest {
  id: string;
  requestNo: string;
  requestedAt: string;
  jobNo: string;
  assetCode: string;
  assetName: string;
  assetModel: string;
  imageUrl: string | null;
  requester: string;
  requesterSection: string;
  diagnosis: string;
  solution: string;
  statusCode: string;
  workflowStep: number;
  parts: SpareApprovalPart[];
  rejectionReason?: string;
}

export interface SpareApprovalDecision {
  note?: string;
}

export interface SpareRejectionDecision {
  reason: string;
}
