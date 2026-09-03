import { create } from "zustand";
import { RepairJob } from "../Types/TypeRepairWorkflow";

interface RepairHistoryModalState {
  isOpen: boolean;
  selectedJob: RepairJob | null;
  openModal: (job: RepairJob) => void;
  closeModal: () => void;
}

export const useRepairHistoryModalStore = create<RepairHistoryModalState>(
  (set) => ({
    isOpen: false,
    selectedJob: null,
    openModal: (job) => set({ isOpen: true, selectedJob: job }),
    closeModal: () => set({ isOpen: false, selectedJob: null }),
  }),
);
