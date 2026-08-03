import { create } from "zustand"
import type {
  BorrowHistoryAsset,
  BorrowHistoryStatusFilter,
} from "../types/borrowHistoryTypes"
import type {
  BorrowTransactionInput,
  ReturnTransactionInput,
} from "../types/manageBorrowTypes"
import { borrowHistoryService } from "../services/borrowHistoryTransaction"

// 1. นิยามประเภทข้อมูลสำหรับ Filter
export interface BorrowHistoryFilters {
  search: string
  status: BorrowHistoryStatusFilter
}

interface BorrowHistoryState {
  // States
  rawHistoryAssets: BorrowHistoryAsset[]
  filters: BorrowHistoryFilters
  currentPage: number
  pageSize: number

  // Actions & Setters
  setFilters: (newFilters: Partial<BorrowHistoryFilters>) => void
  setCurrentPage: (page: number) => void

  // Async API Actions (ดึงข้อมูล / สร้างประวัติ / อัปเดตคืน)
  fetchHistoryAssets: () => Promise<void>
  createHistoryRecord: (
    assetCode: string,
    assetName: string,
    input: BorrowTransactionInput
  ) => Promise<boolean>
  updateReturnRecord: (input: ReturnTransactionInput) => Promise<boolean>

  // Selectors (คำนวณข้อมูลส่งให้ UI)
  getFilteredHistoryAssets: () => BorrowHistoryAsset[]
  getPaginatedHistoryAssets: () => BorrowHistoryAsset[]
}

export const useBorrowHistoryStore = create<BorrowHistoryState>((set, get) => ({
  // 1. Initial States
  rawHistoryAssets: [],
  filters: {
    search: "",
    status: "ทั้งหมด",
  },
  currentPage: 1,
  pageSize: 10, // จำนวนรายการต่อหน้า (ตรงกับ UI และ Pagination Component)

  // 2. Setters (พร้อม Reset หน้ากลับไปหน้า 1 อัตโนมัติเมื่อมีการค้นหา/เปลี่ยน Filter)
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      currentPage: 1,
    })),
  setCurrentPage: (page) => set({ currentPage: page }),

  // 3. API Actions
  fetchHistoryAssets: async () => {
    try {
      const data = await borrowHistoryService.fetchBorrowHistoryAssets()
      set({ rawHistoryAssets: data })
    } catch (error) {
      console.error("Failed to fetch borrow history assets:", error)
    }
  },

  createHistoryRecord: async (assetCode, assetName, input) => {
    const success = await borrowHistoryService.createHistoryRecord(
      assetCode,
      assetName,
      input
    )
    if (success) {
      await get().fetchHistoryAssets()
    }
    return success
  },

  updateReturnRecord: async (input) => {
    const success = await borrowHistoryService.updateReturnRecord(input)
    if (success) {
      await get().fetchHistoryAssets()
    }
    return success
  },

  // 4. Data Selectors

  // กรองข้อมูลตาม Search Query และ Status
  getFilteredHistoryAssets: () => {
    const { rawHistoryAssets, filters } = get()
    const { search, status } = filters
    const q = search.trim().toLowerCase()

    return rawHistoryAssets.filter((item) => {
      // ค้นหาจาก รหัสการยืม, รหัสครุภัณฑ์, ชื่อครุภัณฑ์ หรือ ชื่อผู้ยืม
      const matchSearch =
        !q ||
        item.borrowCode.toLowerCase().includes(q) ||
        item.assetCode.toLowerCase().includes(q) ||
        item.assetName.toLowerCase().includes(q) ||
        item.borrowerName.toLowerCase().includes(q)

      // กรองตามสถานะ (ทั้งหมด / คืนแล้ว / ยังไม่คืน)
      const matchStatus = status === "ทั้งหมด" || item.status === status

      return matchSearch && matchStatus
    })
  },

  // ตัดแบ่งข้อมูลเฉพาะของหน้านั้นๆ นำไป render ใน <Table />
  getPaginatedHistoryAssets: () => {
    const { currentPage, pageSize } = get()
    const filtered = get().getFilteredHistoryAssets()
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  },
}))
