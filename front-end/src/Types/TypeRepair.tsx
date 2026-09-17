export type ReportType = "Repair" | "Maintenance" | null;
export type UrgencyStatus = "NORMAL" | "URGENT" | "EMERGENCY";

export interface CreateRepairDto {
  assetId: string;
  symptom: string;
  urgencyStatus: UrgencyStatus;
  reportType: ReportType;
}

export interface AssetApiResponse {
  id: string;
  noid: string;
  name: string;
  model: string;
  serialNo: string;
  type?: {
    id: number;
    name: string;
  };
  equipmentType?: {
    id: number;
    name: string;
  };
  section?: {
    id: string;
    code: string;
    name: string;
    building?: string;
  };
}

export interface AssetInfo {
  assetId: string;
  assetCode: string;
  assetName: string;
  category: string;
  location: string;
}

export interface RepairFormState {
  reportType: ReportType;
  assetSearchInput: string;
  assetInfo: AssetInfo | null;
  location: string;
  urgencyStatus: UrgencyStatus;
  symptom: string;
}
