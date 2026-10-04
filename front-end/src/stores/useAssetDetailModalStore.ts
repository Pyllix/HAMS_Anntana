import { create } from "zustand";
import type { Asset } from "../types/TypeAsset";

interface AssetDetailModalState {
  isOpen: boolean;
  selectedAsset: Asset | null;
  openModal: (asset: Asset) => void;
  updateSelectedAsset: (asset: Asset) => void;
  closeModal: () => void;
}

export const useAssetDetailModalStore = create<AssetDetailModalState>((set) => ({
  isOpen: false,
  selectedAsset: null,
  openModal: (asset) => set({ isOpen: true, selectedAsset: asset }),
  updateSelectedAsset: (asset) => set((state) => state.selectedAsset?.id === asset.id
    ? { selectedAsset: asset }
    : state),
  closeModal: () => set({ isOpen: false, selectedAsset: null }),
}));
