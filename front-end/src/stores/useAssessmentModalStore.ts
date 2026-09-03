import { create } from "zustand";
import type { RepairListItem } from "../Types/TypeAssessment";

export type AssessmentViewMode = "list" | "form";

interface AssessmentState {
  viewMode: AssessmentViewMode;
  selectedJob: RepairListItem | null;
  openAssessmentForm: (job: RepairListItem) => void;
  closeForm: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set) => ({
  viewMode: "list",
  selectedJob: null,

  openAssessmentForm: (job) =>
    set({ viewMode: "form", selectedJob: job }),

  closeForm: () =>
    set({ viewMode: "list", selectedJob: null }),
}));