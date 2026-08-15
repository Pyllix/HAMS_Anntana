import { create } from "zustand"
import type {
  Asset,
  BorrowStatusFilter,
  BorrowTransactionInput,
  ReturnTransactionInput,
} from "../types/manageBorrowTypes"
import { manageBorrowService } from "../services/manageBorrowTransaction"

//นิยามประเภทข้อมูลสำหรับ Filter
export interface BorrowFilters {
  search: string
  status: BorrowStatusFilter
  categoryCode: string
}

interface ManageBorrowState {
  // States
  rawAssets: Asset[]
  filters: BorrowFilters
  currentPage: number
  pageSize: number

  // Actions & Setters
  setFilters: (newFilters: Partial<BorrowFilters>) => void
  setCurrentPage: (page: number) => void

  // Async API Actions (ยืม / คืน / ดึงข้อมูล)
  fetchAssets: () => Promise<void>
  borrowAsset: (input: BorrowTransactionInput) => Promise<boolean>
  returnAsset: (input: ReturnTransactionInput) => Promise<boolean>

  // Selectors (คำนวณข้อมูลส่งให้ UI)
  getFilteredAssets: () => Asset[]
  getPaginatedAssets: () => Asset[]
}

export const useManageBorrowStore = create<ManageBorrowState>((set, get) => ({
  //Initial States
  rawAssets: [],
  filters: {
    search: "",
    status: "ทั้งหมด",
    categoryCode: "ทั้งหมด",
  },
  currentPage: 1,
  pageSize: 10,

  //Setters (พร้อม Reset หน้ากลับไปหน้า 1 อัตโนมัติเมื่อมีการค้นหา/เปลี่ยน Filter)
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      currentPage: 1,
    })),
  setCurrentPage: (page) => set({ currentPage: page }),

  //API Actions
  fetchAssets: async () => {
    try {
      const data = await manageBorrowService.fetchAssets()
      set({ rawAssets: data })
    } catch (error) {
      console.error("Failed to fetch assets:", error)
    }
  },

  borrowAsset: async (input) => {
    const success = await manageBorrowService.borrowAsset(input)
    if (success) {
      await get().fetchAssets()
    }
    return success
  },

  returnAsset: async (input) => {
    const success = await manageBorrowService.returnAsset(input)
    if (success) {
      await get().fetchAssets()
    }
    return success
  },

  //Data Selectors
  // กรองข้อมูลตาม Search Query, Status และ Type
  getFilteredAssets: () => {
    const { rawAssets, filters } = get()
    const { search, status, categoryCode } = filters
    const q = search.trim().toLowerCase()

    return rawAssets.filter((item) => {
      // ค้นหาจาก ชื่อ, รหัสครุภัณฑ์ หรือ ชื่อผู้ยืม
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.borrower && item.borrower.toLowerCase().includes(q))

      // กรองตามสถานะ (ทั้งหมด / ว่าง / กำลังยืม / ส่งซ่อม)
      const matchStatus = status === "ทั้งหมด" || item.status === status

      // กรองตามประเภทครุภัณฑ์
      const matchCategory =
        categoryCode === "ทั้งหมด" ||
        item.category.code === categoryCode ||
        item.category.name === categoryCode

      return matchSearch && matchStatus && matchCategory
    })
  },

  // ตัดแบ่งข้อมูลเฉพาะของหน้านั้นๆ นำไป render ใน <Table />
  getPaginatedAssets: () => {
    const { currentPage, pageSize } = get()
    const filtered = get().getFilteredAssets()
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  },
}))
