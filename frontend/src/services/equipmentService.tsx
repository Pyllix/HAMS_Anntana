import { mockEquipments, mockTransactionHistory } from "@/mock-up/data"
import type {
  Equipment,
  TransactionHistory,
  EquipmentStatus,
  HistoryStatus,
  EquipmentCategory,
} from "@/types/types"
import {
  EQUIPMENT_STATUS,
  HISTORY_STATUS,
  EQUIPMENT_CATEGORIES,
} from "@/types/types"

export const equipmentService = {
  getEquipments: (): Equipment[] => {
    return mockEquipments
  },

  getEquipmentStatus: (): Record<EquipmentStatus, string> => {
    return EQUIPMENT_STATUS
  },
  getEquipmentCategories: (): EquipmentCategory[] => {
    return EQUIPMENT_CATEGORIES
  },
}

export const transactionService = {
  getTransactionHistory: (): TransactionHistory[] => {
    return mockTransactionHistory
  },
  getTransactionHistoryStatus: (): Record<HistoryStatus, string> => {
    return HISTORY_STATUS
  },
}
