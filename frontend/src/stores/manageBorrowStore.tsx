import { create } from "zustand"
import type {
  Asset,
  BorrowStatusFilter,
  BorrowTransactionInput,
  ReturnTransactionInput,
} from "../types/manageBorrowTypes"
import { mockManageBorrowAssets } from "../mock-up/manageBorrowMockData"
import { manageBorrowService } from "../services/manageBorrowTransaction"

interface ManageBorrowState {
  assets: Asset[]
  searchQuery: string
  statusFilter: BorrowStatusFilter
  typeFilter: string
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: BorrowStatusFilter) => void
  setTypeFilter: (code: string) => void
  checkOutAsset: (id: string, data: BorrowTransactionInput) => void
  checkInAsset: (id: string, data: ReturnTransactionInput) => void
}

export const useManageBorrowStore = create<ManageBorrowState>((set) => ({
  assets: mockManageBorrowAssets,
  searchQuery: "",
  statusFilter: "ทั้งหมด",
  typeFilter: "ทั้งหมด",

  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setTypeFilter: (code) => set({ typeFilter: code }),

  checkOutAsset: (id, data) =>
    set((state) => ({
      assets: manageBorrowService.processBorrow(state.assets, id, data),
    })),

  checkInAsset: (id, data) =>
    set((state) => ({
      assets: manageBorrowService.processReturn(state.assets, id, data),
    })),
}))
