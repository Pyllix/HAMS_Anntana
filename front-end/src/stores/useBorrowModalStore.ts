import { create } from "zustand";
import type { Asset } from "../types/TypeAsset";

interface borrowModalState {
  isFormOpen: boolean;
  selectedAsset: Asset | null;
  openForm: (asset: Asset) => void;
  closeForm: () => void;
}

export const useBorrowModalStore = create<borrowModalState>((set) => ({
  isFormOpen: false,
  selectedAsset: null,
  openForm: (asset) => set({ isFormOpen: true, selectedAsset: asset }),
  closeForm: () => set({ isFormOpen: false, selectedAsset: null }),
}));
