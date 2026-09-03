import { create } from "zustand";
import type { PartOrder } from "../Types/TypePartOrder";

interface PartOrderModalState {
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
