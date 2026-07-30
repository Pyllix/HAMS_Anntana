export type BorrowAssetStatus = "ว่าง" | "กำลังยืม" | "ส่งซ่อม"
export type BorrowStatusFilter = "ทั้งหมด" | BorrowAssetStatus

export type ReturnCondition = "ปกติ" | "ชำรุด / ส่งซ่อม"

export interface AssetCategory {
  code: string
  name: string
}

export interface Asset {
  id: string
  code: string
  name: string
  type: string
  status: BorrowAssetStatus
  borrowerName?: string
  ward?: string
  borrowDate?: string
}

export interface BorrowTransactionInput {
  equipmentId: string
  borrowerName: string
  ward: string
  borrowDate: string
  borrowTime: string
  deliveryMethod: "มารับด้วยตนเอง" | "ให้เจ้าหน้าที่นำไปส่ง"
}

export interface ReturnTransactionInput {
  equipmentId: string
  returnMethod: "มาส่งคืนด้วยตนเอง" | "ให้เจ้าหน้าที่ไปรับคืน"
  condition: ReturnCondition
  returnDate: string
  remark?: string
}
