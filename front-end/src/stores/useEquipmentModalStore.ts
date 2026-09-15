import { create } from "zustand";
import type { Asset } from "../types/TypeAsset";

interface EquipmentModalState {
  isOpen: boolean;
  mode: "create" | "edit";
  selectedAsset: Asset | null;
  openCreate: () => void;
  openEdit: (asset: Asset) => void;
  closeModal: () => void;
}

export const useEquipmentModalStore = create<EquipmentModalState>((set) => ({
  isOpen: false,
  mode: "create",
  selectedAsset: null,
  openCreate: () =>
    set({
      isOpen: true,
      mode: "create",
      selectedAsset: null,
    }),
  openEdit: (asset: Asset) =>
    set({
      isOpen: true,
      mode: "edit",
      selectedAsset: asset,
    }),
  closeModal: () =>
    set({
      isOpen: false,
      selectedAsset: null,
    }),
}));
