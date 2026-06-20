import type { Asset } from "../types/manageBorrowTypes"

export const mockManageBorrowAssets: Asset[] = [
  {
    id: "BP-2024-001",
    name: "เครื่องวัดความดัน (BP)",
    type: "01-ครุภัณฑ์วิทยาศาสตร์และการแพทย์",
    borrower: "พญ. ใจดี รักษา\nER (ฉุกเฉิน)",
    borrowDate: "24 ก.พ. 2569",
    status: "กำลังยืม",
    image: "circle",
  },
  {
    id: "AED-2024-005",
    name: "เครื่องกระตุกหัวใจ (AED)",
    type: "01-ครุภัณฑ์วิทยาศาสตร์และการแพทย์",
    borrower: "-\nCentral Supply",
    borrowDate: "-",
    status: "ว่าง",
    image: "square",
  },
  {
    id: "WC-2023-012",
    name: "รถเข็นผู้ป่วย (Wheelchair)",
    type: "01-ครุภัณฑ์วิทยาศาสตร์และการแพทย์",
    borrower: "ช่างเทคนิค\nฝ่ายซ่อมบำรุง",
    borrowDate: "20 ก.พ. 2569",
    status: "ส่งซ่อม",
    image: "dot",
  },
]
