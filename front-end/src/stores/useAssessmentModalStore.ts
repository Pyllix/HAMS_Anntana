import { create } from "zustand";
import type {
  RepairListItem,
  RepairMetaLookups,
} from "../Types/TypeAssessment";

export type AssessmentViewMode = "list" | "form";
export type AssessmentFormType = "assess" | "assign";

interface AssessmentState {
  viewMode: AssessmentViewMode;
  formType: AssessmentFormType;
  selectedJob: RepairListItem | null;
  lookups: RepairMetaLookups | null | undefined;
  openAssessmentForm: (
    job: RepairListItem,
    lookups?: RepairMetaLookups | null,
  ) => void;
  openAssignModal: (
    job: RepairListItem,
    lookups?: RepairMetaLookups | null,
  ) => void;
  closeForm: () => void;
  setLookups: (lookups: RepairMetaLookups | null | undefined) => void;
}

export const useAssessmentStore = create<AssessmentState>((set) => ({
  viewMode: "list",
  formType: "assess",
  selectedJob: null,
  lookups: null,

  openAssessmentForm: (job, lookups = null) =>
    set((state) => ({
      viewMode: "form",
      formType: "assess",
      selectedJob: job,
      lookups: lookups !== undefined ? lookups : state.lookups,
    })),

  openAssignModal: (job, lookups = null) =>
    set((state) => ({
      viewMode: "form",
      formType: "assign",
      selectedJob: job,
      lookups: lookups !== undefined ? lookups : state.lookups,
    })),

  closeForm: () =>
    set({ viewMode: "list", formType: "assess", selectedJob: null }),

  setLookups: (lookups) => set({ lookups }),
}));
