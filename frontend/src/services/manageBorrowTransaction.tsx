import { mockManageBorrowAssets } from "@/mock-up/manageBorrowMockData"
import type {
  Asset,
  BorrowTransactionInput,
  ReturnTransactionInput,
} from "../types/manageBorrowTypes"

// เพิ่ม Import borrowHistoryService เพื่อสั่งงานข้ามไปหน้าประวัติ
import { borrowHistoryService } from "../services/borrowHistoryTransaction"

// เก็บ State จำลองไว้ในไฟล์ Service (เสมือนเป็น Database ชั่วคราว)
let localAssets = [...mockManageBorrowAssets]

export const manageBorrowService = {
  // ดึงข้อมูลรายการครุภัณฑ์ทั้งหมด (จำลอง async/await)
  fetchAssets: async (): Promise<Asset[]> => {
    await new Promise((res) => setTimeout(res, 300))
    return [...localAssets]
  },

  // ทำรายการยืมครุภัณฑ์
  borrowAsset: async (input: BorrowTransactionInput): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 300))

    // หาครุภัณฑ์ที่จะยืมไว้ก่อน เพื่อเอา code และ name ไปลงประวัติ
    const targetAsset = localAssets.find((a) => a.id === input.assetId)

    localAssets = localAssets.map((asset) =>
      asset.id === input.assetId
        ? {
            ...asset,
            status: "กำลังยืม",
            borrower: input.borrowerName,
            department: input.department,
            borrowDate: input.borrowDate,
            borrowTime: input.borrowTime,
          }
        : asset
    )
    // เรียกสร้าง Record ประวัติการยืมใหม่
    if (targetAsset) {
      await borrowHistoryService.createHistoryRecord(
        targetAsset.code,
        targetAsset.name,
        input
      )
    }

    return true
  },

  // ทำรายการรับคืนครุภัณฑ์
  returnAsset: async (input: ReturnTransactionInput): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 300))

    const isRepaired = input.condition === "ชำรุด / ส่งซ่อม"

    localAssets = localAssets.map((asset) => {
      if (asset.id !== input.assetId) return asset

      // สภาพชำรุด -> ปรับสถานะเป็น "ส่งซ่อม" และย้ายสังกัดไปฝ่ายซ่อมบำรุง
      if (isRepaired) {
        return {
          ...asset,
          status: "ส่งซ่อม",
          borrower: "ช่างเทคนิค",
          department: "ฝ่ายซ่อมบำรุง",
          borrowDate: input.returnDate,
          note: input.note,
        }
      }

      // สภาพปกติ -> ปรับสถานะเป็น "ว่าง" เพื่อให้ผู้อื่นยืมต่อได้
      return {
        ...asset,
        status: "ว่าง",
        borrower: "-",
        department: "Central Supply",
        borrowDate: "-",
        borrowTime: undefined,
        deleteNote: undefined,
      }
    })

    // เรียกอัปเดตประวัติรายการนี้ให้เปลี่ยนสถานะเป็น "คืนแล้ว"
    await borrowHistoryService.updateReturnRecord(input)

    return true
  },
}
