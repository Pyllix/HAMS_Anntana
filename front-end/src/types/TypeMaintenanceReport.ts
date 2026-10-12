import type { RepairJob } from "./TypeRepairWorkflow";

export type MaintenanceReportPeriodMode = "DAY" | "MONTH";

export type MaintenanceDocumentType =
  | "WORK_ORDER"
  | "PARTS_REQUEST"
  | "REPAIR_SUMMARY"
  | "PERIOD_REPORT";

export type MaintenanceReportStatusFilter =
  | "ALL"
  | "OPEN"
  | "COMPLETED"
  | "CANCELLED";

export interface MaintenanceReportPeriod {
  mode: MaintenanceReportPeriodMode;
  value: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

export interface MaintenanceReportPrintContext {
  preparedBy: string;
  preparedAt: Date;
}

export interface MaintenanceJobPrintRequest {
  type: Exclude<MaintenanceDocumentType, "PERIOD_REPORT">;
  job: RepairJob;
  context: MaintenanceReportPrintContext;
}

export interface MaintenancePeriodPrintRequest {
  type: "PERIOD_REPORT";
  jobs: RepairJob[];
  period: MaintenanceReportPeriod;
  context: MaintenanceReportPrintContext;
}
