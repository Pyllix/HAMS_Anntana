import type { AssetCategory } from "./common"

export type StockAssetStatus = "ใช้งานปกติ" | "สภาพชำรุด" | "รอจำหน่าย" | "ส่งคืนคลัง"

// ใช้เฉพาะตอน filter dropdown เท่านั้น ห้ามใช้กับ field สถานะจริงของ asset
export type StockStatusFilter = StockAssetStatus | "ทั้งหมด"

export interface PurchaseInfo {
  receivedDate: string // วันที่ตรวจรับ
  company: string // บริษัทที่จัดซื้อ
  price: number // ราคาจัดซื้อ
  budgetType: string // ประเภทเงินงบประมาณ
}

export interface WarrantyInfo {
  expireDate: string // วันที่หมดประกัน
  inWarranty: boolean
  lifetimeYears: number // อายุการใช้งาน (ปี)
  usedDuration: string // เช่น "2 ปี 1 เดือน"
}

export interface StockAsset {
  id: string // database key ภายใน ไม่โชว์ผู้ใช้
  pid: string // รหัสครุภัณฑ์ (PID) ที่ติดบนตัวเครื่องจริง
  name: string
  model: string // ยี่ห้อ / รุ่น
  serialNumber: string // S/N
  category: AssetCategory
  department: string // หน่วยงานที่รับผิดชอบ
  location: string // เช่น "อาคาร 1 ชั้น 3"
  status: StockAssetStatus
  imageUrl?: string
  purchase: PurchaseInfo
  warranty: WarrantyInfo
  repairHistoryCount: number
  calibrationHistoryCount: number
}