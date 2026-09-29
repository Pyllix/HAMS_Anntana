import { create } from "zustand";
import type { Asset } from "../types/TypeAsset";

interface DisposalModalState {
  // 1. Dialog Waiting for sale (บันทึกข้อมูลเพื่อรอจำหน่าย)
  isWaitDisposalOpen: boolean;
  waitDisposalAsset: Asset | null;
  openWaitDisposal: (asset: Asset) => void;
  closeWaitDisposal: () => void;

  // 2. Dialog Confirm sales (ยืนยันการอนุมัติจำหน่ายครุภัณฑ์)
  isConfirmDisposalOpen: boolean;
  confirmDisposalAsset: Asset | null;
  openConfirmDisposal: (asset: Asset) => void;
  closeConfirmDisposal: () => void;

  // 3. Dialog Mark Lost (ยืนยันปรับเป็นสูญหาย)
  isMarkLostOpen: boolean;
  markLostAsset: Asset | null;
  openMarkLost: (asset: Asset) => void;
  closeMarkLost: () => void;

  // 4. Dialog Send Assessment (ส่งประเมินสภาพครุภัณฑ์ไปยังช่าง)
  isSendAssessmentOpen: boolean;
  sendAssessmentAsset: Asset | null;
  openSendAssessment: (asset: Asset) => void;
  closeSendAssessment: () => void;
}

export const useDisposalModalStore = create<DisposalModalState>((set) => ({
  isWaitDisposalOpen: false,
  waitDisposalAsset: null,
  openWaitDisposal: (asset: Asset) =>
    set({
      isWaitDisposalOpen: true,
      waitDisposalAsset: asset,
    }),
  closeWaitDisposal: () =>
    set({
      isWaitDisposalOpen: false,
      waitDisposalAsset: null,
    }),

  isConfirmDisposalOpen: false,
  confirmDisposalAsset: null,
  openConfirmDisposal: (asset: Asset) =>
    set({
      isConfirmDisposalOpen: true,
      confirmDisposalAsset: asset,
    }),
  closeConfirmDisposal: () =>
    set({
      isConfirmDisposalOpen: false,
      confirmDisposalAsset: null,
    }),

  isMarkLostOpen: false,
  markLostAsset: null,
  openMarkLost: (asset: Asset) =>
    set({
      isMarkLostOpen: true,
      markLostAsset: asset,
    }),
  closeMarkLost: () =>
    set({
      isMarkLostOpen: false,
      markLostAsset: null,
    }),

  isSendAssessmentOpen: false,
  sendAssessmentAsset: null,
  openSendAssessment: (asset: Asset) =>
    set({
      isSendAssessmentOpen: true,
      sendAssessmentAsset: asset,
    }),
  closeSendAssessment: () =>
    set({
      isSendAssessmentOpen: false,
      sendAssessmentAsset: null,
    }),
}));
