import { create } from "zustand";
import type { BorrowExtension } from "../services/borrowService";

interface RejectExtensionModalState {
  isFormOpen: boolean;
  selectedExtension: BorrowExtension | null;
  openForm: (extension: BorrowExtension) => void;
  closeForm: () => void;
}

export const useRejectExtensionModalStore = create<RejectExtensionModalState>(
  (set) => ({
    isFormOpen: false,
    selectedExtension: null,
    openForm: (extension) =>
      set({ isFormOpen: true, selectedExtension: extension }),
    closeForm: () => set({ isFormOpen: false, selectedExtension: null }),
  }),
);
