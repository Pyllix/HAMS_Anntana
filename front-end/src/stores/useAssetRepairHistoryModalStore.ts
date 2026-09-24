import { create } from "zustand";
import type { Asset } from "../types/TypeAsset";

interface AssetRepairHistoryModalState {
  isOpen: boolean;
  asset: Asset | null;
  openModal: (asset: Asset) => void;
  closeModal: () => void;
}

export const useAssetRepairHistoryModalStore =
  create<AssetRepairHistoryModalState>((set) => ({
    isOpen: false,
    asset: null,
    openModal: (asset) => set({ isOpen: true, asset }),
    closeModal: () => set({ isOpen: false, asset: null }),
  }));
