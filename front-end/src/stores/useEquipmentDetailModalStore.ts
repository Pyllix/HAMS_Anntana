import { create } from "zustand";
import type { Asset } from "../types/TypeAsset";

interface EquipmentDetailModalState {
  isOpen: boolean;
  selectedAsset: Asset | null;
  openModal: (asset: Asset) => void;
  updateSelectedAsset: (asset: Asset) => void;
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
  updateSelectedAsset: (asset: Asset) =>
    set((state) => state.selectedAsset?.id === asset.id
      ? { selectedAsset: asset }
      : state),
  closeModal: () =>
    set({
      isOpen: false,
      selectedAsset: null,
    }),
}));
