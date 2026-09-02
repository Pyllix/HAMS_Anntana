import { create } from "zustand";
import { RepairJob } from "../Types/TypeRepairWorkflow";

interface ConfirmRepairModalState {
  isOpen: boolean;
  selectedJob: RepairJob | null;
  openModal: (job: RepairJob) => void;
  closeModal: () => void;
}

export const useConfirmRepairModalStore = create<ConfirmRepairModalState>(
  (set) => ({
    isOpen: false,
    selectedJob: null,
    openModal: (job) => set({ isOpen: true, selectedJob: job }),
    closeModal: () => set({ isOpen: false, selectedJob: null }),
  }),
);
