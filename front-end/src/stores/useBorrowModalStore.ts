import { create } from "zustand";
import { AssetDto } from "../types/TypeAsset";

interface borrowModalState {
  isFormOpen: boolean;
  selectedAsset: AssetDto | null;
  openForm: (asset: AssetDto) => void;
  closeForm: () => void;
}

export const useBorrowModalStore = create<borrowModalState>((set) => ({
  isFormOpen: false,
  selectedAsset: null,
  openForm: (asset) => set({ isFormOpen: true, selectedAsset: asset }),
  closeForm: () => set({ isFormOpen: false, selectedAsset: null }),
}));
