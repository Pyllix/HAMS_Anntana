import { create } from "zustand"
import type {
  Asset,
  BorrowStatusFilter,
  BorrowTransactionInput,
  ReturnTransactionInput,
} from "@/types/equipmentBorrowTypes"
import { mockEquipmentBorrowAssets } from "@/mock-up/equipmentBorrowMockData"
import { equipmentBorrowService } from "@/services/equipmentBorrowTransaction"

interface EquipmentBorrowState {
  assets: Asset[]
  searchQuery: string
  statusFilter: BorrowStatusFilter
  typeFilter: string
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: BorrowStatusFilter) => void
  setTypeFilter: (type: string) => void
  checkOutAsset: (id: string, data: BorrowTransactionInput) => void
  checkInAsset: (id: string, data: ReturnTransactionInput) => void
}

export const useEquipmentBorrowStore = create<EquipmentBorrowState>((set) => ({
  assets: mockEquipmentBorrowAssets,
  searchQuery: "",
  statusFilter: "ทั้งหมด",
  typeFilter: "ทั้งหมด",

  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setTypeFilter: (type) => set({ typeFilter: type }),

  checkOutAsset: (id, data) =>
    set((state) => ({
      assets: equipmentBorrowService.processBorrow(state.assets, id, data),
    })),

  checkInAsset: (id, data) =>
    set((state) => ({
      assets: equipmentBorrowService.processReturn(state.assets, id, data),
    })),
}))
