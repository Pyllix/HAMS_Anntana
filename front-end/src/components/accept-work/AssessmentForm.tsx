import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Loader2,
  UserPlus,
  XCircle,
  ClipboardCheck,
  X,
} from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import AssetInfoCard from "./AssetInfoCard";
import CommonEvaluationFields from "./CommonEvaluationFields";
import TechnicianConfirmDialog from "../unrepairable-technician/TechnicianConfirmDialog";
import InternalSpareFields from "./InternalSpareFields";
import type { SelectedSpareItem } from "./InternalSpareFields";
import MechanicSelector from "./MechanicSelector";
import { useAssessmentStore } from "../../stores/useAssessmentModalStore";
import { useAuthStore } from "../../stores/authStore";
import type {
  DiagnoseDto,
  StepActionType,
  Mechanic,
  RepairDetail,
  RepairMetaLookups,
} from "../../Types/TypeAssessment";
import {
  createEvaluation,
  getRepairJobById,
  getMechanics,
  getMechanicWorkloads,
  getRepairMetaLookups,
  assignMechanics,
  cancelRepairJob,
} from "../../services/assessmentService";

export type ActionTypeUI =
  | "ซ่อมเองได้"
  | "ขอเบิกอะไหล่"
  | "ส่งซ่อมภายนอก"
  | "ไม่สามารถซ่อมได้";

export interface AssessmentFormState {
  symptomCause: string;
  diagnosis?: string;
  solution: string;
  causeId: string | number;
  jobTypeId: string | number;
  techCategoryId: string | number;
  isRepeatRepair?: boolean;
  dueDate: string | number;
  technicalDiagnosisDetail: string;
  unrepairableReason: string;
}

const INITIAL_FORM_STATE: AssessmentFormState = {
  symptomCause: "",
  diagnosis: "",
  solution: "",
  causeId: "",
  jobTypeId: "",
  techCategoryId: "",
  isRepeatRepair: undefined,
  dueDate: "",
  technicalDiagnosisDetail: "",
  unrepairableReason: "",
};

const ACTION_TYPE_MAP: Record<ActionTypeUI, StepActionType> = {
  ซ่อมเองได้: "SELF_REPAIR",
  ขอเบิกอะไหล่: "WITH_PARTS",
  ส่งซ่อมภายนอก: "OUTSOURCE",
  ไม่สามารถซ่อมได้: "UNREPAIRABLE",
};

const REVERSE_ACTION_TYPE_MAP: Record<StepActionType, ActionTypeUI> = {
  SELF_REPAIR: "ซ่อมเองได้",
  WITH_PARTS: "ขอเบิกอะไหล่",
  OUTSOURCE: "ส่งซ่อมภายนอก",
  UNREPAIRABLE: "ไม่สามารถซ่อมได้",
};

const normalizeMechanicIds = (ids: (string | number)[]): string[] => {
  return ids
    .map((id) => String(id).trim())
    .filter(
      (id) => id !== "" && id !== "null" && id !== "undefined" && id !== "NaN",
    );
};

function requestErrorMessage(error: unknown): string {
  const errorObj = error as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const raw = errorObj?.response?.data?.message || errorObj?.message;
  return Array.isArray(raw)
    ? raw.join(" / ")
    : raw || "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
}

export default function AssessmentForm() {
  const queryClient = useQueryClient();

  const { user } = useAuthStore();
  const isHeadRole = user?.role === "MAINTENANCE_HEAD";

  const selectedJob = useAssessmentStore((state) => state.selectedJob);
  const closeForm = useAssessmentStore((state) => state.closeForm);

  const [actionStatus, setActionStatus] = useState<ActionTypeUI>("ซ่อมเองได้");
  const [formState, setFormState] =
    useState<AssessmentFormState>(INITIAL_FORM_STATE);
  const [selectedMechanicIds, setSelectedMechanicIds] = useState<
    (string | number)[]
  >([]);
  const [selectedSpares, setSelectedSpares] = useState<SelectedSpareItem[]>([]);

  // Cancel Dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const currentJobId = selectedJob?.id;
  const displayJobNo = selectedJob?.jobNo || `JOB-${currentJobId || ""}`;
  const draftStorageKey = `draft_assessment_${displayJobNo}`;

  const { data: metaLookups } = useQuery<RepairMetaLookups>({
    queryKey: ["repairMetaLookups"],
    queryFn: getRepairMetaLookups,
  });

  const {
    data: jobDetail,
    isLoading: isDetailLoading,
    isError: isDetailError,
  } = useQuery<RepairDetail>({
    queryKey: ["assessmentJobDetail", currentJobId],
    queryFn: () => getRepairJobById(String(currentJobId)),
    enabled: Boolean(currentJobId),
  });

  // ตรวจสอบว่างานนี้มีการมอบหมายให้ผู้ใช้งานนี้แล้วหรือไม่
  const isAssignedToMe = useMemo(() => {
    const list =
      jobDetail?.mechanicRepairs ||
      (selectedJob as any)?.mechanicRepairs ||
      (selectedJob as any)?.mechanics ||
      [];
    const currentUserId = String(user?.id ?? "");
    const currentMechanicId = String(
      (user as any)?.mechanicId ?? user?.id ?? "",
    );

    return list.some((m: any) => {
      const mUserId = String(m.userId ?? m.user?.id ?? m.id ?? "");
      const mMechanicId = String(m.mechanicId ?? m.id ?? "");
      return (
        (mUserId && mUserId === currentUserId) ||
        (mMechanicId && mMechanicId === currentMechanicId) ||
        (mUserId && mUserId === currentMechanicId) ||
        (mMechanicId && mMechanicId === currentUserId)
      );
    });
  }, [jobDetail, selectedJob, user]);

  // เป็นโหมดมอบหมายงานเฉพาะเมื่อเป็นหัวหน้าช่าง และ งานนี้ยังไม่มีการมอบหมายตนเอง
  const isAssignMode = isHeadRole && !isAssignedToMe;

  // ดึงข้อมูลรายชื่อช่าง: ถ้าเป็น Assign Mode (หัวหน้ามอบหมาย) ให้ดึง Workloads (งานค้าง) ถ้าประเมินงานให้ดึงรายชื่อช่างธรรมดา
  const { data: mechanics = [] } = useQuery<Mechanic[]>({
    queryKey: ["repairMechanics", isAssignMode],
    queryFn: isAssignMode ? getMechanicWorkloads : getMechanics,
  });

  const {
    data: jobDetail,
    isLoading: isDetailLoading,
    isError: isDetailError,
  } = useQuery<RepairDetail>({
    queryKey: ["assessmentJobDetail", currentJobId],
    queryFn: () => getRepairJobById(String(currentJobId)),
    enabled: Boolean(currentJobId),
  });

  useEffect(() => {
    if (!currentJobId) return;
    if (!isAssignMode) {
      const savedDraft = localStorage.getItem(draftStorageKey);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          setActionStatus(
            parsed.actionStatus === "ขอซื้อทดแทน"
              ? "ไม่สามารถซ่อมได้"
              : parsed.actionStatus === "ขอเบิกอะไหล่ภายใน" ||
                  parsed.actionStatus === "ขอเบิกอะไหล่ภายนอก"
                ? "ขอเบิกอะไหล่"
                : parsed.actionStatus || "ซ่อมเองได้",
          );
          setFormState(parsed.formState || INITIAL_FORM_STATE);
          setSelectedMechanicIds(parsed.selectedMechanicIds || []);
          setSelectedSpares(parsed.selectedSpares || []);
          return;
        } catch (error) {
          console.error("Failed to parse draft:", error);
        }

      }
    }

    setActionStatus("ซ่อมเองได้");
    setFormState(INITIAL_FORM_STATE);
    setSelectedMechanicIds([]);
    setSelectedSpares([]);
  }, [currentJobId, draftStorageKey, isAssignMode]);

  useEffect(() => {
    if (!jobDetail) return;
    setFormState((previous) => ({
      ...previous,
      jobTypeId: previous.jobTypeId || "",
      techCategoryId: previous.techCategoryId || jobDetail.techCategoryId || "",
      causeId: previous.causeId || jobDetail.causeId || "",
      isRepeatRepair: jobDetail.isRepeatRepair !== undefined ? jobDetail.isRepeatRepair : previous.isRepeatRepair,
    }));

    if (!isAssignMode) {
      setSelectedMechanicIds((previous) =>
        previous.length
          ? previous
          : normalizeMechanicIds(
              (jobDetail.mechanicRepairs || []).map((item) => item.userId),
            ),
      );
    }
  }, [jobDetail, isAssignMode]);

  // Mutation สำหรับการประเมิน (สำหรับช่างทั่วไป หรือ หัวหน้าช่างที่รับซ่อมเอง)
  const diagnoseMutation = useMutation({
    mutationFn: async (dto: DiagnoseDto) => {
      if (!currentJobId) return;
      return await createEvaluation(String(currentJobId), dto);
    },
    onSuccess: async () => {
      alert("บันทึกผลการประเมินสำเร็จ");
      if (draftStorageKey) localStorage.removeItem(draftStorageKey);
      await queryClient.invalidateQueries({ queryKey: ["pendingEvaluations"] });
      await queryClient.invalidateQueries({ queryKey: ["repairList"] });
      await queryClient.invalidateQueries({ queryKey: ["repairJobs"] });
      await queryClient.invalidateQueries({ queryKey: ["acceptWorkList"] });
      closeForm();
    },
    onError: (err: unknown) => {
      alert(`ไม่สามารถทำรายการได้: ${requestErrorMessage(err)}`);
    },
  });

  // Mutation สำหรับหัวหน้าช่างจ่ายงาน (POST /repairs/{id}/assign)
  const assignMutation = useMutation({
    mutationFn: async (payload: {
      techCategoryId: number;
      mechanicIds: (string | number)[];
    }) => {
      if (!currentJobId) return;
      return await assignMechanics(String(currentJobId), {
        techCategoryId: Number(payload.techCategoryId),
        mechanicIds: payload.mechanicIds.map((id) => String(id)),
      });
    },
    onSuccess: async () => {
      alert("มอบหมายงานซ่อมให้ช่างเรียบร้อยแล้ว");
      await queryClient.invalidateQueries({ queryKey: ["pendingEvaluations"] });
      await queryClient.invalidateQueries({ queryKey: ["repairList"] });
      await queryClient.invalidateQueries({ queryKey: ["repairJobs"] });
      await queryClient.invalidateQueries({ queryKey: ["acceptWorkList"] });
      closeForm();
    },
    onError: (err: unknown) => {
      alert(`ไม่สามารถจ่ายงานได้: ${requestErrorMessage(err)}`);
    },
  });

  // Mutation สำหรับการยกเลิกใบแจ้งซ่อม (สำหรับช่าง และ หัวหน้าช่าง)
  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!currentJobId) return;
      return await cancelRepairJob(String(currentJobId), {
        reason: reason,
      } as any);
    },
    onSuccess: async () => {
      alert("ยกเลิกใบแจ้งซ่อมเรียบร้อยแล้ว");
      setShowCancelDialog(false);
      setCancelReason("");

      closeForm();

      // บังคับ Refetch และล้าง Cache รายการทุกตารางที่เกี่ยวข้อง
      await queryClient.invalidateQueries({ queryKey: ["pendingEvaluations"] });
      await queryClient.invalidateQueries({ queryKey: ["repairList"] });
      await queryClient.invalidateQueries({ queryKey: ["repairJobs"] });
      await queryClient.invalidateQueries({ queryKey: ["acceptWorkList"] });

      await queryClient.refetchQueries({ queryKey: ["pendingEvaluations"] });
      await queryClient.refetchQueries({ queryKey: ["repairList"] });
      await queryClient.refetchQueries({ queryKey: ["repairJobs"] });
      await queryClient.refetchQueries({ queryKey: ["acceptWorkList"] });
    },
    onError: async (err: unknown) => {
      const errMsg = requestErrorMessage(err);

      // ถ้า Backend แจ้งว่าใบแจ้งซ่อมถูกยกเลิกไปแล้ว ให้แจ้งเตือนและรีเฟรชหน้าเพื่อปิดฟอร์ม
      if (errMsg.includes("already CANCELLED")) {
        alert("ใบแจ้งซ่อมนี้ถูกยกเลิกไปแล้ว");
        setShowCancelDialog(false);
        setCancelReason("");
        closeForm();

        await queryClient.invalidateQueries({
          queryKey: ["pendingEvaluations"],
        });
        await queryClient.invalidateQueries({ queryKey: ["repairList"] });
        await queryClient.invalidateQueries({ queryKey: ["repairJobs"] });
        await queryClient.invalidateQueries({ queryKey: ["acceptWorkList"] });
        return;
      }

      alert(`ไม่สามารถยกเลิกใบแจ้งซ่อมได้: ${errMsg}`);
    },
  });

  const isFormValid = useMemo(() => {
    if (isAssignMode) {
      // หัวหน้าช่างจ่ายงาน ต้องการหมวดงาน + ช่างผู้รับผิดชอบอย่างน้อย 1 คน
      return (
        Boolean(formState.techCategoryId) && selectedMechanicIds.length > 0
      );
    }

    // ช่างซ่อมประเมินงาน
    const hasCommonFields =
      Boolean(actionStatus) &&
      Boolean(formState.symptomCause?.trim() || formState.diagnosis?.trim()) &&
      Boolean(formState.solution?.trim()) &&
      Boolean(formState.causeId) &&
      Boolean(formState.jobTypeId) &&
      Boolean(formState.techCategoryId) &&
      formState.isRepeatRepair !== undefined &&
      Boolean(formState.technicalDiagnosisDetail?.trim()) &&
      (actionStatus === "ไม่สามารถซ่อมได้" ||
        Boolean(String(formState.dueDate ?? "").trim())) &&
      selectedMechanicIds.length > 0;

    if (!hasCommonFields) return false;
    if (actionStatus === "ขอเบิกอะไหล่") return selectedSpares.length > 0;
    if (actionStatus === "ส่งซ่อมภายนอก") return true;
    if (actionStatus === "ไม่สามารถซ่อมได้")
      return Boolean(formState.unrepairableReason?.trim());
    if (actionStatus === "ไม่สามารถซ่อมได้") {
      return Boolean(formState.unrepairableReason?.trim());
    }

    return true;
  }, [
    isAssignMode,
    formState,
    actionStatus,
    selectedMechanicIds,
    selectedSpares,
  ]);

  const handleToggleMechanic = (mechanicId: number | string) => {
    if (mechanicId === undefined || mechanicId === null) return;
    const targetId = String(mechanicId);

    setSelectedMechanicIds((prev) => {
      const exists = prev.some((item) => String(item) === targetId);
      return exists
        ? prev.filter((item) => String(item) !== targetId)
        : [...prev, targetId];
    });
  };

  const handleSubmit = () => {
    if (!isFormValid || assignMutation.isPending || diagnoseMutation.isPending)
      return;

    if (isAssignMode) {
      assignMutation.mutate({
        techCategoryId: Number(formState.techCategoryId),
        mechanicIds: selectedMechanicIds.map((id) => String(id)),
      });
      return;
    }
    
    // Process Diagnose DTO for Technicians
    const stepActionType = ACTION_TYPE_MAP[actionStatus];
    const selectedDetail = jobDetail;
    if (!selectedDetail) return;
    let formattedDueDate = "";
    if (
      stepActionType !== "UNREPAIRABLE" &&
      stepActionType !== "WITH_PARTS" &&
      formState.dueDate
    ) {
      const days = Number(formState.dueDate);
      if (!isNaN(days) && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        formattedDueDate = d.toISOString().slice(0, 10);
      } else {
        formattedDueDate = String(formState.dueDate).slice(0, 10);
      }
    }

    const dto: DiagnoseDto = {
      stepActionType,
      actionType: selectedDetail?.actionType || "REPAIR",
      techCategoryId: Number(formState.techCategoryId),
      jobTypeId: Number(formState.jobTypeId),
      diagnosis:
        actionStatus === "ไม่สามารถซ่อมได้"
          ? formState.technicalDiagnosisDetail.trim()
          : formState.diagnosis?.trim() || formState.symptomCause?.trim() || "-",
      solution: formState.solution?.trim() || "-",
      causeId: Number(formState.causeId) || 0,
      isRepeatRepair: Boolean(formState.isRepeatRepair),
      dueDate: formattedDueDate,
      unrepairableReason:
        stepActionType === "UNREPAIRABLE"
          ? formState.unrepairableReason.trim()
          : undefined,
      spareParts:
        stepActionType === "WITH_PARTS"
          ? selectedSpares.map((sp) => ({
              sparepartId: Number(sp.id),
              qty: Number(sp.quantity) || 1,
              stockType: sp.stockType || "INTERNAL",
            }))
          : undefined,
    };

    diagnoseMutation.mutate(dto);
  };

  const handleSubmit = () => {
    if (!isFormValid || mutation.isPending || isDetailLoading || isDetailError)
      return;
    if (actionStatus === "ไม่สามารถซ่อมได้") {
      mutation.reset();
      setShowUnrepairableReview(true);
      return;
    }
    submitAssessment();
  };

  if (!selectedJob) return null;

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={closeForm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            ย้อนกลับ
          </button>
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <span
              className={`font-semibold ${isAssignMode ? "text-blue-600" : "text-emerald-600"}`}
            >
              {isAssignMode ? "มอบหมายงานซ่อม" : "ประเมินการซ่อม"} (
              {displayJobNo})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-md text-xs font-bold font-mono ${isAssignMode ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}
          >
            {displayJobNo}
          </span>
          <span className="px-3 py-1 rounded-md bg-amber-50 text-amber-600 text-xs font-semibold">
            ● รอดำเนินการ{isAssignMode ? "จ่ายงาน" : "ประเมิน"}
          </span>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Asset Details */}
        <div className="lg:col-span-5">
          <AssetInfoCard jobData={selectedJob} />
        </div>

        {/* Right Side: Action Form */}
        <div className="lg:col-span-7 bg-white border border-slate-100 shadow-2xs rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <span
                  className={`p-1 rounded-md ${isAssignMode ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}
                >
                  {isAssignMode ? (
                    <UserPlus className="w-4 h-4" />
                  ) : (
                    <ClipboardCheck className="w-4 h-4" />
                  )}
                </span>
                {isAssignMode
                  ? "มอบหมายงานซ่อมให้ช่าง"
                  : "บันทึกผลการประเมินและงานซ่อม"}
              </div>
            </div>

            {isAssignMode ? (
              /* ฟอร์มมอบหมายงานสำหรับหัวหน้าช่าง */
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    หมวดช่าง <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formState.techCategoryId}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        techCategoryId: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden bg-white"
                  >
                    <option value="" disabled>
                      -- เลือกหมวดช่าง --
                    </option>
                    {(metaLookups?.techCategories || []).map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <MechanicSelector
                  usersList={mechanics}
                  selectedMechanicIds={selectedMechanicIds}
                  onToggleMechanic={handleToggleMechanic}
                />
              </div>
            ) : (
              /* ฟอร์มประเมินสำหรับช่างปฏิบัติงาน */
              <>
                {/* 1. ย้าย หมวดช่าง (Disabled / Read-only) ขึ้นมาไว้บนสุด */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    หมวดช่าง <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formState.techCategoryId}
                    disabled
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-500 bg-slate-100 cursor-not-allowed"
                  >
                    <option value="">
                      {(metaLookups?.techCategories || []).find(
                        (cat: any) =>
                          String(cat.id) === String(formState.techCategoryId),
                      )?.name || "งานเครื่องมือแพทย์"}
                    </option>
                  </select>
                </div>

                {/* 2. ผู้รับผิดชอบงาน (Read-only) */}
                <MechanicSelector
                  usersList={mechanics}
                  selectedMechanicIds={selectedMechanicIds}
                  onToggleMechanic={handleToggleMechanic}
                  readOnly={true}
                />

                {/* 3. ฟิลด์ประเมินส่วนกลาง */}
                <CommonEvaluationFields
                  actionStatus={ACTION_TYPE_MAP[actionStatus]}
                  setActionStatus={(stepAction) => {
                    const mapped = REVERSE_ACTION_TYPE_MAP[stepAction];
                    if (mapped) setActionStatus(mapped);
                  }}
                  formState={formState as any}
                  setFormState={setFormState as any}
                  causes={metaLookups?.causes || []}
                  jobTypes={metaLookups?.jobTypes || []}
                  techCategories={metaLookups?.techCategories || []}
                  isTechCategoryDisabled={true}
                />

                {actionStatus === "ขอเบิกอะไหล่" && (
                  <InternalSpareFields
                    selectedSpares={selectedSpares}
                    setSelectedSpares={setSelectedSpares}
                  />
                )}
              </>
            )}
          </div>

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div>
              <button
                type="button"
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelMutation.isPending || assignMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                ยกเลิกใบแจ้งซ่อม
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={
                  !isFormValid ||
                  assignMutation.isPending ||
                  diagnoseMutation.isPending
                }
                onClick={handleSubmit}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors ${
                  isFormValid &&
                  !assignMutation.isPending &&
                  !diagnoseMutation.isPending
                    ? isAssignMode
                      ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                      : "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {(assignMutation.isPending || diagnoseMutation.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {isAssignMode ? "ยืนยันการจ่ายงาน" : "บันทึกผลการประเมิน"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal ยกเลิกใบแจ้งซ่อม (Inline Replacement for TechnicianConfirmDialog) */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                ยืนยันการยกเลิกใบแจ้งซ่อม
              </h3>
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  if (!cancelMutation.isPending) {
                    cancelMutation.reset();
                    setShowCancelDialog(false);
                    setCancelReason("");
                  }
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Content */}
            <div className="p-5 space-y-4">
              {cancelMutation.isError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-xs text-rose-600 border border-rose-200">
                  {requestErrorMessage(cancelMutation.error)}
                </div>
              )}

              {/* ไอคอนและข้อความเตือนด้านบน */}
              <div className="flex items-center gap-3 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700">
                <div className="p-2 bg-rose-100 rounded-lg shrink-0 text-rose-600">
                  <XCircle className="w-6 h-6" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-sm text-rose-800">
                    คุณกำลังจะยกเลิกใบแจ้งซ่อมนี้
                  </p>
                  <p className="text-rose-600">
                    การยกเลิกจะไม่สามารถย้อนกลับได้ กรุณาตรวจสอบข้อมูลก่อนยืนยัน
                  </p>
                </div>
              </div>

              {/* กล่องแสดงรายละเอียด Job */}
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-500">
                    รหัสใบแจ้งซ่อม:
                  </span>
                  <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                    {displayJobNo}
                  </span>
                </div>
                <div className="pt-1 font-semibold text-slate-800 flex items-start gap-1">
                  <span className="text-slate-400 font-normal">ครุภัณฑ์:</span>
                  <span>
                    {selectedJob?.asset?.noid || jobDetail?.asset?.noid} ·{" "}
                    {selectedJob?.asset?.name || jobDetail?.asset?.name}
                  </span>
                </div>
              </div>

              {/* ช่องกรอกเหตุผล */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-700">
                  เหตุผลการยกเลิกใบแจ้งซ่อม <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="กรอกเหตุผลที่ต้องการยกเลิกใบแจ้งซ่อมฉบับนี้..."
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              {/* Dialog Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    if (!cancelMutation.isPending) {
                      cancelMutation.reset();
                      setShowCancelDialog(false);
                      setCancelReason("");
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    if (!cancelReason.trim()) {
                      alert("กรุณาระบุเหตุผลการยกเลิกใบแจ้งซ่อม");
                      return;
                    }
                    cancelMutation.mutate(cancelReason.trim());
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {cancelMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  ยืนยันยกเลิกใบแจ้งซ่อม
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}