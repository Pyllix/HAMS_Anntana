export type AssetStatus = "ทั้งหมด" | "ว่าง" | "กำลังยืม" | "ส่งซ่อม"
export type AssetType =
  | "ทั้งหมด"
  | "01-ครุภัณฑ์วิทยาศาสตร์และการแพทย์"
  | "06-ครุภัณฑ์โฆษณาและเผยแพร่"
  | "07-ครุภัณฑ์ยานพาหนะและขนส่ง"

export interface Asset {
  id: string
  name: string
  type: AssetType
  borrower: string
  borrowDate: string
  status: AssetStatus
  image: string
}

export interface BorrowTransactionInput {
  borrowerName: string
  department: string
  borrowDate: string
  borrowTime: string
}

export interface ReturnTransactionInput {
  returnerName: string
  condition: "ปกติ (พร้อมใช้งาน)" | "ชำรุด / ส่งซ่อม"
  returnDate: string
  returnTime: string
  note?: string
}
