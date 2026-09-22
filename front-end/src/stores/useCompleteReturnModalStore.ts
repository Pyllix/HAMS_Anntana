import { create } from "zustand";
import type { BorrowHistory } from "../services/borrowService";

interface CompleteReturnModalState {
  isFormOpen: boolean;
  selectedTransaction: BorrowHistory | null;
  openForm: (transaction: BorrowHistory) => void;
  closeForm: () => void;
}

export const useCompleteReturnModalStore = create<CompleteReturnModalState>(
  (set) => ({
    isFormOpen: false,
    selectedTransaction: null,
    openForm: (transaction) =>
      set({ isFormOpen: true, selectedTransaction: transaction }),
    closeForm: () => set({ isFormOpen: false, selectedTransaction: null }),
  }),
);
