import { create } from "zustand";
import type { BorrowHistory } from "../services/borrowService";

interface RequestReturnModalState {
  isFormOpen: boolean;
  selectedTransaction: BorrowHistory | null;
  openForm: (transaction: BorrowHistory) => void;
  closeForm: () => void;
}

export const useRequestReturnModalStore = create<RequestReturnModalState>(
  (set) => ({
    isFormOpen: false,
    selectedTransaction: null,
    openForm: (transaction) =>
      set({ isFormOpen: true, selectedTransaction: transaction }),
    closeForm: () => set({ isFormOpen: false, selectedTransaction: null }),
  }),
);
