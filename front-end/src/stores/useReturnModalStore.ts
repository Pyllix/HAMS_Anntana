import { create } from "zustand";
import type { Asset } from "../types/TypeAsset";

interface returnModalStore {
  isFormOpen: boolean;
  selectedAsset: Asset | null;
  openForm: (asset: Asset) => void;
  closeForm: () => void;
}

export const useReturnModalStore = create<returnModalStore>((set) => ({
  isFormOpen: false,
  selectedAsset: null,
  openForm: (asset) => set({ selectedAsset: asset, isFormOpen: true }),
  closeForm: () => set({ isFormOpen: false, selectedAsset: null }),
}));
