import type { Asset } from "../types/manageBorrowTypes"
import type { AssetCategory } from "@/types/common"

export const BORROW_CATEGORIES: AssetCategory[] = [
  { code: "01", name: "ครุภัณฑ์วิทยาศาสตร์และการแพทย์" },
  { code: "02", name: "ครุภัณฑ์สำนักงาน" },
  { code: "03", name: "ครุภัณฑ์ไฟฟ้าและวิทยุ" },
  { code: "04", name: "ครุภัณฑ์งานบ้าน งานครัว" },
  { code: "05", name: "ครุภัณฑ์คอมพิวเตอร์" },
  { code: "06", name: "ครุภัณฑ์โฆษณาและเผยแพร่" },
  { code: "07", name: "ครุภัณฑ์ยานพาหนะและขนส่ง" },
]
export const mockManageBorrowAssets: Asset[] = [
  {
    id: "1",
    name: "เครื่องวัดความดัน (BP)",
    code: "BP-2024-001",
    category: BORROW_CATEGORIES[0],
    borrower: "พญ. ใจดี รักษา",
    department: "ER (ฉุกเฉิน)",
    borrowDate: "24 ก.พ. 2569",
    status: "กำลังยืม",
    image: "circle",
  },
  {
    id: "2",
    name: "เครื่องกระตุกหัวใจ (AED)",
    code: "AED-2024-005",
    category: BORROW_CATEGORIES[0],
    borrower: "-",
    department: "Central Supply",
    borrowDate: "-",
    status: "ว่าง",
    image: "square",
  },
  {
    id: "3",
    name: "รถเข็นผู้ป่วย (Wheelchair)",
    code: "WC-2023-012",
    category: BORROW_CATEGORIES[0],
    borrower: "ช่างเทคนิค",
    department: "ฝ่ายซ่อมบำรุง",
    borrowDate: "20 ก.พ. 2569",
    status: "ส่งซ่อม",
    image: "dot",
  },
]
