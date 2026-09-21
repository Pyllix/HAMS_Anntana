import { create } from "zustand";
import type { BorrowHistory } from "../services/borrowService";

interface RejectModalState {
  isFormOpen: boolean;
  selectedTransaction: BorrowHistory | null;
  openForm: (transaction: BorrowHistory) => void;
  closeForm: () => void;
}

export const useRejectModalStore = create<RejectModalState>((set) => ({
  isFormOpen: false,
  selectedTransaction: null,
  openForm: (transaction) =>
    set({ isFormOpen: true, selectedTransaction: transaction }),
  closeForm: () => set({ isFormOpen: false, selectedTransaction: null }),
}));
