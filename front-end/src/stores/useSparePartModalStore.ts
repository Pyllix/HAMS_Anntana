import { create } from 'zustand';
import type { Sparepart } from '../Types/TypeSparePart';

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface SparePartDetailModalState {
  isOpen: boolean;
  selectedItem: Sparepart | null;
  openModal: (item: Sparepart) => void;
  closeModal: () => void;
}

export const useSparePartDetailModalStore =
  create<SparePartDetailModalState>((set) => ({
    isOpen: false,
    selectedItem: null,
    openModal: (item) => set({ isOpen: true, selectedItem: item }),
    closeModal: () => set({ isOpen: false, selectedItem: null }),
  }));

// ─── Form Modal (Add / Edit) ──────────────────────────────────────────────────

interface SparePartFormModalState {
  isOpen: boolean;
  editItem: Sparepart | null;
  openAdd: () => void;
  openEdit: (item: Sparepart) => void;
  closeModal: () => void;
}

export const useSparePartFormModalStore = create<SparePartFormModalState>(
  (set) => ({
    isOpen: false,
    editItem: null,
    openAdd: () => set({ isOpen: true, editItem: null }),
    openEdit: (item) => set({ isOpen: true, editItem: item }),
    closeModal: () => set({ isOpen: false, editItem: null }),
  }),
);

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface SparePartDeleteModalState {
  isOpen: boolean;
  targetItem: Sparepart | null;
  openDelete: (item: Sparepart) => void;
  closeModal: () => void;
}

export const useSparePartDeleteModalStore =
  create<SparePartDeleteModalState>((set) => ({
    isOpen: false,
    targetItem: null,
    openDelete: (item) => set({ isOpen: true, targetItem: item }),
    closeModal: () => set({ isOpen: false, targetItem: null }),
  }));
