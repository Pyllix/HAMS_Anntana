import { create } from "zustand";
import type { ReportType, UrgencyStatus, AssetInfo } from "../Types/TypeRepair";

interface RepairStoreState {
  reportType: ReportType;
  assetSearchInput: string;
  assetInfo: AssetInfo | null;
  location: string;
  urgencyStatus: UrgencyStatus;
  symptom: string;
  isConfirmModalOpen: boolean;

  setReportType: (type: ReportType | null) => void;
  setAssetSearchInput: (input: string) => void;
  setAssetInfo: (info: AssetInfo | null) => void;
  setLocation: (location: string) => void;
  setUrgencyStatus: (status: UrgencyStatus) => void;
  setSymptom: (symptom: string) => void;
  openConfirmModal: () => void;
  closeConfirmModal: () => void;
  resetForm: () => void;
}

export const useRepairStore = create<RepairStoreState>((set) => ({
  reportType: null,
  assetSearchInput: "",
  assetInfo: null,
  location: "",
  urgencyStatus: "NORMAL",
  symptom: "",
  isConfirmModalOpen: false,

  setReportType: (reportType) => set({ reportType }),
  setAssetSearchInput: (assetSearchInput) => set({ assetSearchInput }),
  setAssetInfo: (assetInfo) => set({ assetInfo }),
  setLocation: (location) => set({ location }),
  setUrgencyStatus: (urgencyStatus) => set({ urgencyStatus }),
  setSymptom: (symptom) => set({ symptom }),
  openConfirmModal: () => set({ isConfirmModalOpen: true }),
  closeConfirmModal: () => set({ isConfirmModalOpen: false }),
  resetForm: () =>
    set({
      reportType: null,
      assetSearchInput: "",
      assetInfo: null,
      location: "",
      urgencyStatus: "NORMAL",
      symptom: "",
      isConfirmModalOpen: false,
    }),
}));
