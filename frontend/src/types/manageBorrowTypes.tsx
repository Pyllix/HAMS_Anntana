import type { AssetCategory } from "./common"
export type BorrowAssetStatus = "ว่าง" | "กำลังยืม" | "ส่งซ่อม"
export type BorrowStatusFilter = "ทั้งหมด" | BorrowAssetStatus

export interface Asset {
  id: string
  code: string
  name: string
  category: AssetCategory
  borrower?: string
  department?: string
  borrowDate?: string
  borrowTime?: string
  status: BorrowAssetStatus
  image?: string
  note?: string
}

export interface BorrowTransactionInput {
  assetId: string
  borrowerName: string
  department: string
  borrowDate: string
  borrowTime: string
}

export interface ReturnTransactionInput {
  assetId: string
  returnerName: string
  condition: "ปกติ (พร้อมใช้งาน)" | "ชำรุด / ส่งซ่อม"
  returnDate: string
  returnTime: string
  note?: string
}
