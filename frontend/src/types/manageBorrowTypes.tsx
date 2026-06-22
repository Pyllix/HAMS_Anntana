export type BorrowAssetStatus = "ว่าง" | "กำลังยืม" | "ส่งซ่อม"
export type BorrowStatusFilter = "ทั้งหมด" | BorrowAssetStatus

export interface Asset {
  id: string
  name: string
  categoryCode: string
  borrower: string
  borrowDate: string
  status: BorrowAssetStatus
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
