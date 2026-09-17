import { create } from "zustand";
import type { PartOrder } from "../Types/TypePartOrder";

interface PartOrderModalState {
  // Modal สร้างรายการสั่งซื้ออะไหล่ใหม่ (Create Order / Stock-In)
  isCreateModalOpen: boolean;
  preselectedSparepartId: number | null;
  openCreateModal: (sparepartId?: number) => void;
  closeCreateModal: () => void;

  // Modal ระบุข้อมูลจัดซื้อ (Add / Edit Purchasing Info)
  isPurchasingModalOpen: boolean;
  selectedOrder: PartOrder | null;
  openPurchasingModal: (order: PartOrder) => void;
  closePurchasingModal: () => void;

  // Modal ดูรายละเอียดคำสั่งซื้อ (View Order Details)
  isDetailModalOpen: boolean;
  openDetailModal: (order: PartOrder) => void;
  closeDetailModal: () => void;
}

export const usePartOrderModalStore = create<PartOrderModalState>((set) => ({
  isCreateModalOpen: false,
  preselectedSparepartId: null,
  openCreateModal: (sparepartId) =>
    set({ isCreateModalOpen: true, preselectedSparepartId: sparepartId ?? null }),
  closeCreateModal: () =>
    set({ isCreateModalOpen: false, preselectedSparepartId: null }),

  isPurchasingModalOpen: false,
  selectedOrder: null,
  openPurchasingModal: (order) =>
    set({ isPurchasingModalOpen: true, selectedOrder: order }),
  closePurchasingModal: () =>
    set({ isPurchasingModalOpen: false, selectedOrder: null }),

  isDetailModalOpen: false,
  openDetailModal: (order) =>
    set({ isDetailModalOpen: true, selectedOrder: order }),
  closeDetailModal: () =>
    set({ isDetailModalOpen: false, selectedOrder: null }),
}));
