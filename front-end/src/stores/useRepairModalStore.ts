import { create } from "zustand";
import type {
  MainCategory,
  ReportType,
  UrgencyStatus,
  AssetInfo,
} from "../Types/TypeRepair";

interface RepairStoreState {
  mainCategory: MainCategory;
  reportType: ReportType;
  assetSearchInput: string;
  assetInfo: AssetInfo | null;
  location: string;
  urgencyStatus: UrgencyStatus;
  symptom: string;
  isConfirmModalOpen: boolean; // เพิ่ม state สำหรับ modal

  setMainCategory: (category: MainCategory) => void;
  setReportType: (type: ReportType) => void;
  setAssetSearchInput: (input: string) => void;
  setAssetInfo: (info: AssetInfo | null) => void;
  setLocation: (location: string) => void;
  setUrgencyStatus: (status: UrgencyStatus) => void;
  setSymptom: (symptom: string) => void;
  openConfirmModal: () => void; // ฟังก์ชันเปิด modal
  closeConfirmModal: () => void; // ฟังก์ชันปิด modal
  resetForm: () => void;
}

export const useRepairStore = create<RepairStoreState>((set) => ({
  mainCategory: "MEDICAL",
  reportType: "Repair",
  assetSearchInput: "",
  assetInfo: null,
  location: "",
  urgencyStatus: "NORMAL",
  symptom: "",
  isConfirmModalOpen: false,

  setMainCategory: (mainCategory) => set({ mainCategory }),
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
      mainCategory: "MEDICAL",
      reportType: "Repair",
      assetSearchInput: "",
      assetInfo: null,
      location: "",
      urgencyStatus: "NORMAL",
      symptom: "",
      isConfirmModalOpen: false,
    }),
}));
