import { mockBorrowHistoryAssets } from "@/mock-up/borrowHistoryMockData"
import type { BorrowHistoryAsset } from "../types/borrowHistoryTypes"
import type {
  BorrowTransactionInput,
  ReturnTransactionInput,
} from "../types/manageBorrowTypes"

// เก็บ State จำลองไว้ในไฟล์ Service (เสมือนเป็น Database ชั่วคราว)
let localBorrowHistoryAssets = [...mockBorrowHistoryAssets]

export const borrowHistoryService = {
  // ดึงข้อมูลรายการประวัติการยืมทั้งหมด (จำลอง async/await)
  fetchBorrowHistoryAssets: async (): Promise<BorrowHistoryAsset[]> => {
    await new Promise((res) => setTimeout(res, 300))
    return [...localBorrowHistoryAssets]
  },

  // สร้างประวัติการยืมใหม่เมื่อมีการกดยืมครุภัณฑ์
  createHistoryRecord: async (
    assetCode: string,
    assetName: string,
    input: BorrowTransactionInput
  ): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 1))

    const newHistoryRecord: BorrowHistoryAsset = {
      id: String(Date.now()),
      borrowCode: `BR-${Math.floor(100000 + Math.random() * 900000)}`,
      assetId: input.assetId,
      assetCode,
      assetName,
      borrowerName: input.borrowerName,
      department: input.department,
      borrowDate: input.borrowDate,
      borrowTime: input.borrowTime,
      returnDate: "-",
      returnTime: "-",
      status: "ยังไม่คืน",
    }

    localBorrowHistoryAssets = [newHistoryRecord, ...localBorrowHistoryAssets]
    return true
  },

  // อัปเดตรายการประวัติเป็นคืนแล้วเมื่อมีการกดคืนครุภัณฑ์ (เฉพาะรายการล่าสุดตัวเดียว)
  updateReturnRecord: async (
    input: ReturnTransactionInput
  ): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 1))

    // ค้นหา Index ของรายการล่าสุดรายการเดียวที่ตรงกับ assetId และสถานะยังไม่คืน
    const targetIndex = localBorrowHistoryAssets.findIndex(
      (item) => item.assetId === input.assetId && item.status === "ยังไม่คืน"
    )

    // แก้ไขเฉพาะ Record นั้นเท่านั้น เพื่อไม่ให้ไปกระทบรายการอื่น
    if (targetIndex !== -1) {
      localBorrowHistoryAssets[targetIndex] = {
        ...localBorrowHistoryAssets[targetIndex],
        returnDate: input.returnDate,
        returnTime: input.returnTime,
        status: "คืนแล้ว",
      }
    }

    return true
  },
}
