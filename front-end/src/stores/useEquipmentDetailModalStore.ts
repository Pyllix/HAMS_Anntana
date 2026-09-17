import { create } from "zustand";
import type { Asset } from "../types/TypeAsset";

interface EquipmentDetailModalState {
  isOpen: boolean;
  selectedAsset: Asset | null;
  openModal: (asset: Asset) => void;
  closeModal: () => void;
}

export const useEquipmentDetailModalStore = create<EquipmentDetailModalState>((set) => ({
  isOpen: false,
  selectedAsset: null,
  openModal: (asset: Asset) =>
    set({
      isOpen: true,
      selectedAsset: asset,
    }),
  closeModal: () =>
    set({
      isOpen: false,
      selectedAsset: null,
    }),
}));
