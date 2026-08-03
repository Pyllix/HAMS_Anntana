// ข้อมูลของ type ที่ใช้ในหน้าจอของเจ้าหน้าที่ศูนย์
export type EquipmentStatus = "borrowing" | "available" | "repairing"
export const EQUIPMENT_STATUS: Record<EquipmentStatus, string> = {
  borrowing: "กำลังยืม",
  available: "ว่าง",
  repairing: "กำลังซ่อม",
}

// ข้อมูล type ที่จะใช้ในหน้าจอประวัติการยืม
export type HistoryStatus = "returned" | "pending"
export const HISTORY_STATUS: Record<HistoryStatus, string> = {
  returned: "คืนเเล้ว",
  pending: "ถูกยืมอยู่",
}

// ประเภทของ Equipment
export type EquipmentCategory =
  | "01-ครุภัณฑ์วิทยาศาสตร์และการแพทย์"
  | "02-ครุภัณฑ์สำนักงาน"
  | "03-ครุภัณฑ์คอมพิวเตอร์"
  | "04-ครุภัณฑ์ยานพาหนะและขนส่ง"
  | "05-ครุภัณฑ์ทั่วไป"

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  "01-ครุภัณฑ์วิทยาศาสตร์และการแพทย์",
  "02-ครุภัณฑ์สำนักงาน",
  "03-ครุภัณฑ์คอมพิวเตอร์",
  "04-ครุภัณฑ์ยานพาหนะและขนส่ง",
  "05-ครุภัณฑ์ทั่วไป",
]

// ตัวข้อมูลของ Equipment
export interface Equipment {
  id: string
  img: string
  name: string
  engName?: string
  category: EquipmentCategory
  borrowerOrDept: string
  borrowDate: string | null
  status: EquipmentStatus
}

// ตัวข้อมูลของ Transaction ประวัติการยืม
export interface TransactionHistory {
  borrowId: string
  equipmentId: string
  equipmentName: string
  borrowerName: string
  borrowDateTime: string
  returnDateTime: string | null
  status: HistoryStatus
}
