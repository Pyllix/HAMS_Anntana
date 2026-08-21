import { create } from "zustand"
import {
  equipmentService,
  transactionService,
} from "@/services/equipmentService"
import type {
  Equipment,
  TransactionHistory,
  EquipmentCategory,
} from "@/types/types"

interface EquipmentStore {
  equipments: Equipment[]
  transactionHistory: TransactionHistory[]
  equipmentStatus: Record<string, string>
  equipmentCategories: EquipmentCategory[]
  fechInitailData: () => void
}

export const useEquipmentStore = create<EquipmentStore>((set) => ({
  equipments: [],
  transactionHistory: [],
  equipmentStatus: {},
  equipmentCategories: [],

  fechInitailData: () => {
    const equipmentsData = equipmentService.getEquipments()
    const historyData = transactionService.getTransactionHistory()
    const statusData = equipmentService.getEquipmentStatus()
    const category = equipmentService.getEquipmentCategories()

    set({
      equipments: equipmentsData,
      transactionHistory: historyData,
      equipmentStatus: statusData,
      equipmentCategories: category,
    })
  },
}))
