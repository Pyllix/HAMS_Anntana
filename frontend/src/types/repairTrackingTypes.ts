export type RepairStatus =
  "รอดำเนินการ" | "กำลังดำเนินการ" | "รออะไหล่" | "เสร็จสิ้น"

export type RepairStatusFilter = "ทั้งหมด" | RepairStatus

export type RepairUrgency = "ด่วนมาก" | "ด่วน" | "ปกติ"

export interface RepairRequest {
  id: string
  requestCode: string
  assetCode: string
  assetName: string
  problem: string
  urgency: RepairUrgency
  reportedAt: string
  status: RepairStatus
}
