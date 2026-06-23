import type { Asset, AssetCategory } from "@/types/equipmentBorrowTypes"

export const BORROW_CATEGORIES: AssetCategory[] = [
  { code: "01", name: "ครุภัณฑ์วิทยาศาสตร์และการแพทย์" },
  { code: "02", name: "ครุภัณฑ์สำนักงาน" },
  { code: "03", name: "ครุภัณฑ์ไฟฟ้าและวิทยุ" },
  { code: "04", name: "ครุภัณฑ์งานบ้าน งานครัว" },
  { code: "05", name: "ครุภัณฑ์คอมพิวเตอร์" },
  { code: "06", name: "ครุภัณฑ์โฆษณาและเผยแพร่" },
  { code: "07", name: "ครุภัณฑ์ยานพาหนะและขนส่ง" },
]

export const mockEquipmentBorrowAssets: Asset[] = [
  {
    id: "1",
    code: "BP-2024-001",
    name: "เครื่องวัดความดัน (BP)",
    type: "01-ครุภัณฑ์วิทยาศาสตร์และการแพทย์",
    status: "ว่าง",
  },
  {
    id: "2",
    code: "AED-2024-005",
    name: "เครื่องกระตุกหัวใจ (AED)",
    type: "01-ครุภัณฑ์วิทยาศาสตร์และการแพทย์",
    status: "ว่าง",
  },
  {
    id: "3",
    code: "WC-2023-012",
    name: "รถเข็นผู้ป่วย (Wheelchair)",
    type: "01-ครุภัณฑ์วิทยาศาสตร์และการแพทย์",
    status: "ว่าง",
  },
  {
    id: "4",
    code: "PC-2024-010",
    name: "คอมพิวเตอร์สำนักงาน",
    type: "05-ครุภัณฑ์คอมพิวเตอร์",
    status: "ว่าง",
  },
  {
    id: "5",
    code: "PRJ-2024-003",
    name: "เครื่องโปรเจคเตอร์",
    type: "06-ครุภัณฑ์โฆษณาและเผยแพร่",
    status: "ว่าง",
  },
  {
    id: "6",
    code: "RAD-2024-002",
    name: "วิทยุสื่อสาร",
    type: "03-ครุภัณฑ์ไฟฟ้าและวิทยุ",
    status: "ว่าง",
  },
]
