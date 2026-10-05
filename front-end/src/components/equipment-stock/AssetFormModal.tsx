import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  X,
  ChevronDown,
  Lock,
} from "lucide-react";
import { useEquipmentModalStore } from "../../stores/useEquipmentModalStore";
import { useEquipmentDetailModalStore } from "../../stores/useEquipmentDetailModalStore";
import { useAssetDetailModalStore } from "../../stores/useAssetDetailModalStore";
import {
  createAsset,
  updateAsset,
  getAssetById,
  getAssetTypes,
  getAssetStatuses,
  getSections,
  getBudgetTypes,
  getEquipmentTypes,
  getAllUsers,
  getAvailabilities,
} from "../../services/assetService";
import { getCompanies } from "../../services/companyService";
import { getAcqTypes } from "../../services/acqTypeService";
import { useAuthStore } from "../../stores/authStore";
import { useSessionDraft } from "../../hooks/useSessionDraft";
import { clearSessionDraft } from "../../services/sessionDraftStorage";
import { useImageUploadSelection } from "../../hooks/useImageUploadSelection";
import ImageUploadField from "../shared/ImageUploadField";
import {
  imageOperationErrorMessage,
  createImageSaveAttempt,
  type ImageFormSaveAttempt,
} from "../../services/imageUploadService";

export default function AssetFormModal() {
  const { isOpen, mode, selectedAsset, closeModal } = useEquipmentModalStore();
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id);
  const imageSelection = useImageUploadSelection({
    purpose: "ASSET_IMAGE",
    targetId: mode === "edit" ? selectedAsset?.id : undefined,
    enabled: isOpen,
  });

  // Queries for Dropdowns
  const { data: assetTypes = [] } = useQuery({
    queryKey: ["assetTypes"],
    queryFn: getAssetTypes,
    enabled: isOpen,
  });

  const { data: assetStatuses = [] } = useQuery({
    queryKey: ["assetStatuses"],
    queryFn: getAssetStatuses,
    enabled: isOpen,
  });

  const { data: availStatuses = [] } = useQuery({
    queryKey: ["availabilities"],
    queryFn: getAvailabilities,
    enabled: isOpen,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
    enabled: isOpen,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
    enabled: isOpen,
  });

  const { data: acqTypes = [] } = useQuery({
    queryKey: ["acqTypes"],
    queryFn: getAcqTypes,
    enabled: isOpen,
  });

  const { data: budgetTypes = [] } = useQuery({
    queryKey: ["budgetTypes"],
    queryFn: getBudgetTypes,
    enabled: isOpen,
  });

  const { data: equipmentTypes = [] } = useQuery({
    queryKey: ["equipmentTypes"],
    queryFn: getEquipmentTypes,
    enabled: isOpen,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: getAllUsers,
    enabled: isOpen,
  });

  // Form State
  const [formData, setFormData] = useState({
    noid: "",
    name: "",
    model: "",
    serialNo: "",
    type_id: "",
    section_id: "",
    asset_status_id: "",
    isSpecial: false,
    isBackup: false,
    equipment_type_id: "",
    owner_id: "",
    acqDoc: "",
    company_id: "",
    acqType: "",
    budgetType: "",
    price: "",
    receivedDate: "",
    warrantyDate: "",
    remark: "",
    pmType: "IM",
    calType: "IC",
    riskLevel: "LOW",
  });

  const [errorMsg, setErrorMsg] = useState<string>("");
  const [saveOutcomeUnknown, setSaveOutcomeUnknown] = useState(false);
  const initializedFormKeyRef = useRef<string | null>(null);
  const submitStartedRef = useRef(false);
  const imageSaveAttemptRef = useRef<ImageFormSaveAttempt<Awaited<ReturnType<typeof createAsset>>> | null>(null);

  useEffect(() => {
    imageSaveAttemptRef.current = null;
    setSaveOutcomeUnknown(false);
  }, [accountId, isOpen, mode, selectedAsset?.id]);

  useEffect(() => {
    if (!isOpen) {
      initializedFormKeyRef.current = null;
      return;
    }
    const formKey = mode === "edit" ? "edit:" + String(selectedAsset?.id ?? "pending") : "create";
    if (initializedFormKeyRef.current === formKey) return;
    initializedFormKeyRef.current = formKey;
    setErrorMsg("");
    setSaveOutcomeUnknown(false);
    imageSaveAttemptRef.current = null;
      if (mode === "edit" && selectedAsset) {
        setFormData({
          noid: selectedAsset.noid || "",
          name: selectedAsset.name || "",
          model: selectedAsset.model || "",
          serialNo: selectedAsset.serialNo || "",
          type_id: String(selectedAsset.type_id || selectedAsset.type?.id || ""),
          section_id: selectedAsset.section_id || selectedAsset.section?.id || "",
          asset_status_id: String(selectedAsset.asset_status_id || selectedAsset.status?.id || ""),
          isSpecial: Boolean(selectedAsset.isSpecial),
          isBackup: Boolean(selectedAsset.isBackup),
          equipment_type_id: selectedAsset.equipment_type_id ? String(selectedAsset.equipment_type_id) : "",
          owner_id: selectedAsset.owner_id || selectedAsset.owner?.id || "",
          acqDoc: selectedAsset.acqDoc || "",
          company_id: selectedAsset.company_id || selectedAsset.company?.id || "",
          acqType: selectedAsset.acqType || "",
          budgetType: selectedAsset.budgetType || "",
          price: selectedAsset.price ? String(selectedAsset.price) : "",
          receivedDate: selectedAsset.receivedDate ? selectedAsset.receivedDate.split("T")[0] : "",
          warrantyDate: selectedAsset.warrantyDate ? selectedAsset.warrantyDate.split("T")[0] : "",
          remark: selectedAsset.remark || "",
          pmType: (selectedAsset as any)?.pmType || "IM",
          calType: (selectedAsset as any)?.calType || "IC",
          riskLevel: (selectedAsset as any)?.riskLevel || "LOW",
        });
      } else {
        // Default create form: find "ใช้งานปกติ" (code === "NORMAL")
        const normalStatus = assetStatuses.find((s) => s.code === "NORMAL") || assetStatuses[0];
        setFormData({
          noid: "",
          name: "",
          model: "",
          serialNo: "",
          type_id: assetTypes[0]?.id ? String(assetTypes[0].id) : "",
          section_id: sections[0]?.id ? String(sections[0].id) : "",
          asset_status_id: normalStatus?.id ? String(normalStatus.id) : "",
          isSpecial: false,
          isBackup: false,
          equipment_type_id: equipmentTypes[0]?.id ? String(equipmentTypes[0].id) : "",
          owner_id: users[0]?.id ? String(users[0].id) : "",
          acqDoc: "",
          company_id: companies[0]?.id ? String(companies[0].id) : "",
          acqType: acqTypes[0]?.name || "จัดซื้อ",
          budgetType: budgetTypes[0]?.name || "เงินงบประมาณ",
          price: "",
          receivedDate: new Date().toISOString().split("T")[0],
          warrantyDate: "",
          remark: "",
          pmType: "IM",
          calType: "IC",
          riskLevel: "LOW",
        });
      }
      }, [isOpen, mode, selectedAsset?.id]);

  useEffect(() => {
    if (!isOpen || mode !== "create") return;
    const normalStatus = assetStatuses.find((status) => status.code === "NORMAL") || assetStatuses[0];
    setFormData((current) => ({
      ...current,
      type_id: current.type_id || (assetTypes[0]?.id ? String(assetTypes[0].id) : ""),
      section_id: current.section_id || (sections[0]?.id ? String(sections[0].id) : ""),
      asset_status_id: current.asset_status_id || (normalStatus?.id ? String(normalStatus.id) : ""),
      equipment_type_id: current.equipment_type_id || (equipmentTypes[0]?.id ? String(equipmentTypes[0].id) : ""),
      owner_id: current.owner_id || (users[0]?.id ? String(users[0].id) : ""),
      company_id: current.company_id || (companies[0]?.id ? String(companies[0].id) : ""),
      acqType: current.acqType || acqTypes[0]?.name || "จัดซื้อ",
      budgetType: current.budgetType || budgetTypes[0]?.name || "เงินงบประมาณ",
    }));
  }, [isOpen, mode, assetTypes, sections, assetStatuses, companies, acqTypes, budgetTypes, users, equipmentTypes]);

  const assetDraftKey = "asset:create";
  const assetDraft = useMemo(
    () => ({ formData: { ...formData } }),
    [formData],
  );

  useSessionDraft({
    key: assetDraftKey,
    accountId,
    enabled: Boolean(accountId && isOpen && mode === "create"),
    value: assetDraft,
    restore: (draft) => {
      if (!draft?.formData || typeof draft.formData !== "object") return;
      const restoredFormData = { ...draft.formData };
      delete (restoredFormData as Record<string, unknown>).imageUrl;
      setFormData((current) => ({
        ...current,
        ...restoredFormData,
      }));
      clearSessionDraft(assetDraftKey);
    },
    isEmpty: (draft) => {
      const data = draft.formData;
      return !(
        data.noid ||
        data.name ||
        data.model ||
        data.serialNo ||
        data.acqDoc ||
        data.price ||
        data.remark
      );
    },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (useAuthStore.getState().user?.id !== accountId) {
        throw new Error("เซสชันผู้ใช้เปลี่ยนแล้ว กรุณาเปิดฟอร์มอีกครั้งก่อนบันทึก");
      }
      if (saveOutcomeUnknown && imageSaveAttemptRef.current?.hasUpload) {
        return imageSaveAttemptRef.current.recover();
      }
      if (["uploading", "verifying", "error"].includes(imageSelection.state.status)) {
        throw new Error("รูปที่เลือกยังไม่พร้อม กรุณารอการตรวจสอบหรือยกเลิกรูปใหม่ก่อนบันทึก");
      }
      // Validate essentials
      if (!formData.name.trim()) throw new Error("กรุณากรอกชื่อครุภัณฑ์");
      if (!formData.model.trim()) throw new Error("กรุณากรอกรุ่นครุภัณฑ์");
      if (!formData.price || isNaN(Number(formData.price))) throw new Error("กรุณากรอกราคาครุภัณฑ์ให้ถูกต้อง");
      if (!formData.receivedDate) throw new Error("กรุณาเลือกวันที่นำเข้า");
      if (!formData.type_id) throw new Error("กรุณาเลือกประเภทครุภัณฑ์");
      if (!formData.section_id) throw new Error("กรุณาเลือกหน่วยงานที่รับผิดชอบ");
      if (!formData.company_id) throw new Error("กรุณาเลือกบริษัทผู้จำหน่าย");
      if (!formData.owner_id) throw new Error("กรุณาเลือกผู้รับผิดชอบ");

      const normalStatus = assetStatuses.find((s) => s.code === "NORMAL");
      const isNormal = String(formData.asset_status_id) === String(normalStatus?.id);
      const availableStatus = availStatuses.find((a) => a.code === "AVAILABLE");
      const unavailableStatus = availStatuses.find((a) => a.code === "UNAVAILABLE");
      const autoAvailabilityId = isNormal ? availableStatus?.id : unavailableStatus?.id;

      const payload = {
        noid: formData.noid.trim() || undefined,
        name: formData.name.trim(),
        model: formData.model.trim(),
        serialNo: formData.serialNo.trim() || undefined,
        budgetType: formData.budgetType || "เงินงบประมาณ",
        acqType: formData.acqType || "จัดซื้อ",
        acqDoc: formData.acqDoc.trim() || "-",
        price: String(formData.price),
        warrantyDate: formData.warrantyDate || undefined,
        equipment_type_id: formData.equipment_type_id ? Number(formData.equipment_type_id) : undefined,
        isSpecial: Boolean(formData.isSpecial),
        isBackup: Boolean(formData.isBackup),
        remark: formData.remark.trim() || undefined,
        receivedDate: formData.receivedDate,
        section_id: formData.section_id,
        company_id: formData.company_id,
        type_id: Number(formData.type_id),
        asset_status_id: Number(formData.asset_status_id || 1),
        ...(autoAvailabilityId ? { availability_status_id: autoAvailabilityId } : {}),
        owner_id: formData.owner_id,
        pmType: formData.pmType || (selectedAsset as any)?.pmType || "IM",
        pmIntervalMonth: (selectedAsset as any)?.pmIntervalMonth ?? 6,
        calType: formData.calType || (selectedAsset as any)?.calType || "IC",
        calIntervalMonth: (selectedAsset as any)?.calIntervalMonth ?? 12,
        riskLevel: formData.riskLevel || (selectedAsset as any)?.riskLevel || "LOW",
      };

      const attempt = createImageSaveAttempt({
        creating: mode === "create",
        targetId: selectedAsset?.id,
        payload,
        upload: imageSelection.state.status === "ready" ? imageSelection.state.upload : null,
        create: createAsset,
        update: updateAsset,
        loadRecord: getAssetById,
      });
      imageSaveAttemptRef.current = attempt;
      return attempt.save();
    },
    onSuccess: (savedAsset) => {
      submitStartedRef.current = false;
      setSaveOutcomeUnknown(false);
      imageSaveAttemptRef.current = null;
      imageSelection.clearSelection();
      clearSessionDraft(assetDraftKey);
      useEquipmentDetailModalStore.getState().updateSelectedAsset(savedAsset);
      useAssetDetailModalStore.getState().updateSelectedAsset(savedAsset);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["my-assets"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-assets-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["assetInfo"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-total-assets"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-normal-assets"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-damaged-assets"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-status"] });
      closeModal();
    },
    onError: (err: any) => {
      submitStartedRef.current = false;
      const unknownOutcome = err?.code === "IMAGE_SAVE_OUTCOME_UNKNOWN";
      setSaveOutcomeUnknown(unknownOutcome);
      if (!unknownOutcome) imageSaveAttemptRef.current = null;
      const code = err?.response?.data?.code ?? err?.code;
      const message = imageOperationErrorMessage(err, "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      if (code === "UPLOAD_EXPIRED" || code === "UPLOAD_NOT_FOUND") {
        imageSelection.markSelectionError(message);
      }
      setErrorMsg(message);
    },
  });

  const handleImageChange = (file: File) => {
    void imageSelection.selectFile(file);
  };

  const canRecoverImageSave = saveOutcomeUnknown && imageSaveAttemptRef.current?.hasUpload === true;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {mode === "create" ? "ลงทะเบียนครุภัณฑ์ใหม่" : "แก้ไขทะเบียนครุภัณฑ์"}
          </h2>
          <button
            onClick={closeModal}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-600">
            {errorMsg}
          </div>
        )}

        {/* Content Form - Beautiful 2-Card Sections */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (submitStartedRef.current || mutation.isPending || (saveOutcomeUnknown && !canRecoverImageSave)) return;
            submitStartedRef.current = true;
            mutation.mutate();
          }}
          className="p-6 space-y-5"
        >
          <fieldset disabled={mutation.isPending || saveOutcomeUnknown} className="contents">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Section 1: ข้อมูลทั่วไปและรูปภาพ (Card 1 - 7 cols) */}
            <div className="lg:col-span-7 bg-slate-50/60 rounded-xl p-4 border border-slate-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-xs font-bold text-slate-800 tracking-wide">
                  1. ข้อมูลพื้นฐานครุภัณฑ์
                </span>
                <span className="text-[11px] text-slate-400">
                  รหัสและรายละเอียดอุปกรณ์
                </span>
              </div>

              <div className="grid grid-cols-12 gap-3.5">
                <div className="col-span-12 sm:col-span-4">
                  <ImageUploadField
                    label="รูปภาพครุภัณฑ์"
                    state={imageSelection.state}
                    currentPreviewUrl={selectedAsset?.imageUrl || null}
                    currentStatus="idle"
                    onSelectFile={handleImageChange}
                    onCancelSelection={imageSelection.clearSelection}
                    disabled={mutation.isPending}
                  />
                </div>

                {/* Primary Fields (8 cols) */}
                <div className="col-span-12 sm:col-span-8 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        รหัสระบบ (ID)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          disabled
                          placeholder="AST-AUTO-GEN"
                          value={mode === "edit" ? (selectedAsset?.id || "AST-AUTO-GEN") : "AST-AUTO-GEN"}
                          className="w-full h-8.5 rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 pr-7 text-xs text-slate-500 font-mono focus:outline-none cursor-not-allowed"
                        />
                        <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        สถานะ <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={formData.asset_status_id}
                          onChange={(e) => setFormData({ ...formData, asset_status_id: e.target.value })}
                          className="w-full h-8.5 rounded-lg border border-emerald-300 bg-emerald-50/60 px-2.5 pr-6 text-xs font-semibold text-emerald-700 appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        >
                          {assetStatuses.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-600 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        หมายเลขครุภัณฑ์ <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="หมายเลขครุภัณฑ์"
                        value={formData.noid}
                        onChange={(e) => setFormData({ ...formData, noid: e.target.value })}
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        ชื่อครุภัณฑ์ <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ชื่อครุภัณฑ์"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        รุ่น (Model) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="รุ่น / โมเดล"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        เลขเครื่อง (Serial No.)
                      </label>
                      <input
                        type="text"
                        placeholder="Serial Number"
                        value={formData.serialNo}
                        onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })}
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary Fields (Classification & Owner) */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    ประเภทครุภัณฑ์ <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.type_id}
                      onChange={(e) => setFormData({ ...formData, type_id: e.target.value })}
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 pr-6 text-xs text-slate-700 appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      {assetTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    ประเภทเครื่องมือ
                  </label>
                  <div className="relative">
                    <select
                      value={formData.equipment_type_id}
                      onChange={(e) => setFormData({ ...formData, equipment_type_id: e.target.value })}
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 pr-6 text-xs text-slate-700 appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      {equipmentTypes.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    หน่วยงานที่รับผิดชอบ <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.section_id}
                      onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 pr-6 text-xs text-slate-700 appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    ผู้รับผิดชอบ <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.owner_id}
                      onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 pr-6 text-xs text-slate-700 appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstname} {u.lastname} ({u.employeeId})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Maintenance & Risk Level fields */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    ระดับความเสี่ยง <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.riskLevel}
                      onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value })}
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 pr-6 text-xs text-slate-700 appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="LOW">ต่ำ (Low)</option>
                      <option value="MEDIUM">ปานกลาง (Medium)</option>
                      <option value="HIGH">สูง (High)</option>
                      <option value="UNSPECIFIED">ไม่ระบุ</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    ประเภท PM <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.pmType}
                      onChange={(e) => setFormData({ ...formData, pmType: e.target.value })}
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 pr-6 text-xs text-slate-700 appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="IM">ช่าง รพ. (IM)</option>
                      <option value="EM">จ้างภายนอก (EM)</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    ประเภท Cal <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.calType}
                      onChange={(e) => setFormData({ ...formData, calType: e.target.value })}
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 pr-6 text-xs text-slate-700 appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="IC">ตรวจสอบเอง (IC)</option>
                      <option value="EC">สอบเทียบภายนอก (EC)</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Special options */}
              <div className="flex items-center gap-6 pt-1">
                <span className="text-[11px] font-medium text-slate-500">
                  คุณสมบัติพิเศษ:
                </span>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isSpecial}
                    onChange={(e) => setFormData({ ...formData, isSpecial: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 border-slate-300 cursor-pointer"
                  />
                  เครื่องมือพิเศษ
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isBackup}
                    onChange={(e) => setFormData({ ...formData, isBackup: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 border-slate-300 cursor-pointer"
                  />
                  เครื่องมือสำรอง
                </label>
              </div>
            </div>

            {/* Section 2: ข้อมูลการจัดซื้อและการเงิน (Card 2 - 5 cols) */}
            <div className="lg:col-span-5 bg-slate-50/60 rounded-xl p-4 border border-slate-100 flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-xs font-bold text-slate-800 tracking-wide">
                  2. ข้อมูลจัดซื้อ & สัญญา
                </span>
                <span className="text-[11px] text-slate-400">
                  คู่ค้าและงบประมาณ
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  บริษัทผู้จำหน่าย <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 pr-6 text-xs text-slate-700 appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    ประเภทการได้รับมา <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.acqType}
                      onChange={(e) => setFormData({ ...formData, acqType: e.target.value })}
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 pr-6 text-xs text-slate-700 appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      {acqTypes.map((a) => (
                        <option key={a.id} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    ประเภทเงินทุน <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.budgetType}
                      onChange={(e) => setFormData({ ...formData, budgetType: e.target.value })}
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 pr-6 text-xs text-slate-700 appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      {budgetTypes.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    ราคาครุภัณฑ์ (บาท) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    เอกสารการได้รับมา
                  </label>
                  <input
                    type="text"
                    placeholder="เลขที่เอกสาร / สัญญา"
                    value={formData.acqDoc}
                    onChange={(e) => setFormData({ ...formData, acqDoc: e.target.value })}
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    วันที่นำเข้า <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.receivedDate}
                    onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    วันที่หมดประกัน
                  </label>
                  <input
                    type="date"
                    value={formData.warrantyDate}
                    onChange={(e) => setFormData({ ...formData, warrantyDate: e.target.value })}
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          </fieldset>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              disabled={mutation.isPending}
              className="px-5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || (saveOutcomeUnknown && !canRecoverImageSave)}
              className="px-6 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {mutation.isPending ? "กำลังบันทึก..." : canRecoverImageSave ? "ตรวจสอบและบันทึกอีกครั้ง" : "บันทึกข้อมูล"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
