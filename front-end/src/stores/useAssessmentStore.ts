import { create } from "zustand";
import type { RepairJob } from "../Types/TypeAssessment";

export type AssessmentViewMode = "list" | "form";

interface AssessmentState {
  viewMode: AssessmentViewMode;
  selectedJob: RepairJob | null;
  openAssessmentForm: (job: RepairJob) => void;
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