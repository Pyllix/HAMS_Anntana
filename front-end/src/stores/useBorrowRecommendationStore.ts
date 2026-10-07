import { create } from "zustand";
import type { Asset } from "../types/TypeAsset";

interface BorrowRecommendationState {
  clickedAsset: Asset | null;
  open: (asset: Asset) => void;
  close: () => void;
}

export const useBorrowRecommendationStore = create<BorrowRecommendationState>(
  (set) => ({
    clickedAsset: null,
    open: (asset) => set({ clickedAsset: asset }),
    close: () => set({ clickedAsset: null }),
  }),
);
