export type BorrowHistoryStatus = "คืนแล้ว" | "ยังไม่คืน"
export type BorrowHistoryStatusFilter = "ทั้งหมด" | BorrowHistoryStatus

export interface BorrowHistoryAsset {
  id: string
  borrowCode: string
  assetId: string
  assetCode: string
  assetName: string
  borrowerName: string
  department: string
  borrowDate: string
  borrowTime?: string
  returnDate: string
  returnTime?: string
  status: BorrowHistoryStatus
}
