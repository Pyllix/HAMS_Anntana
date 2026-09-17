import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, ArrowLeft, Loader2, Pencil } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import AssetInfoCard from "./AssetInfoCard";
import CommonEvaluationFields from "./CommonEvaluationFields";
import TechnicianConfirmDialog from "../unrepairable-technician/TechnicianConfirmDialog";
import InternalSpareFields from "./InternalSpareFields";
import type { SelectedSpareItem } from "./InternalSpareFields";
import ExternalVendorFields from "./ExternalVendorFields";
import MechanicSelector from "./MechanicSelector";
import { useAssessmentStore } from "../../stores/useAssessmentModalStore";
import type {
  RepairDetailDto,
  StepActionType,
  Mechanic,
  RepairDetail,
  RepairMetaLookups,
} from "../../Types/TypeAssessment";
import {
  createEvaluation,
  getRepairJobById,
  getMechanics,
  getRepairMetaLookups,
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
  isRepeatRepair: false,
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
  INTERNAL_STOCK: "ขอเบิกอะไหล่",
  EXTERNAL_STOCK: "ขอเบิกอะไหล่",
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

  const selectedJob = useAssessmentStore((state) => state.selectedJob);
  const closeForm = useAssessmentStore((state) => state.closeForm);

  const [actionStatus, setActionStatus] = useState<ActionTypeUI>("ซ่อมเองได้");
  const [formState, setFormState] =
    useState<AssessmentFormState>(INITIAL_FORM_STATE);
  const [selectedMechanicIds, setSelectedMechanicIds] = useState<
    (string | number)[]
  >([]);
  const [selectedSpares, setSelectedSpares] = useState<SelectedSpareItem[]>([]);
  const [vendorId, setVendorId] = useState<string>("");
  const [showUnrepairableReview, setShowUnrepairableReview] = useState(false);

  const currentJobId = selectedJob?.id;
  const displayJobNo = selectedJob?.jobNo || `JOB-${currentJobId || ""}`;
  const draftStorageKey = `draft_assessment_${displayJobNo}`;

  const { data: metaLookups } = useQuery<RepairMetaLookups>({
    queryKey: ["repairMetaLookups"],
    queryFn: getRepairMetaLookups,
  });


  const { data: mechanics = [] } = useQuery<Mechanic[]>({
    queryKey: ["repairMechanics"],
    queryFn: getMechanics,
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
        setSelectedSpares(
          (parsed.selectedSpares || []).map((item: SelectedSpareItem) => ({
            ...item,
            stockType: item.stockType || "INTERNAL",
          })),
        );
        setVendorId(parsed.vendorId || "");
        return;
      } catch (error) {
        console.error("Failed to parse draft from localStorage:", error);
      }
    }

    setActionStatus("ซ่อมเองได้");
    setFormState(INITIAL_FORM_STATE);
    setSelectedMechanicIds([]);
    setSelectedSpares([]);
    setVendorId("");
  }, [currentJobId, draftStorageKey]);

  useEffect(() => {
    if (!jobDetail) return;
    setFormState((previous) => ({
      ...previous,
      jobTypeId: previous.jobTypeId || jobDetail.jobTypeId || "",
      techCategoryId:
        previous.techCategoryId || jobDetail.techCategoryId || "",
      causeId: previous.causeId || jobDetail.causeId || "",
      isRepeatRepair: jobDetail.isRepeatRepair ?? previous.isRepeatRepair,
    }));
    setSelectedMechanicIds((previous) =>
      previous.length
        ? previous
        : normalizeMechanicIds(
            (jobDetail.mechanicRepairs || []).map((item) => item.userId),
          ),
    );
  }, [jobDetail, draftStorageKey]);

  // Mutation บันทึกการประเมิน
  const mutation = useMutation({
    mutationFn: async (dto: RepairDetailDto) => {
      if (!currentJobId) return;
      return await createEvaluation(String(currentJobId), dto);
    },
    onSuccess: () => {
      setShowUnrepairableReview(false);
      alert("บันทึกผลการประเมินสำเร็จ");
      if (draftStorageKey) {
        localStorage.removeItem(draftStorageKey);
      }
      queryClient.invalidateQueries({ queryKey: ["pendingEvaluations"] });
      queryClient.invalidateQueries({ queryKey: ["repairList"] });
      queryClient.invalidateQueries({ queryKey: ["repairHistory"] });
      closeForm();
    },
    onError: (err: unknown) => {
      if (actionStatus !== "ไม่สามารถซ่อมได้") {
        alert(`ไม่สามารถทำรายการได้: ${requestErrorMessage(err)}`);
      }
    },
  });

  const isFormValid = useMemo(() => {
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

    if (
      actionStatus === "ขอเบิกอะไหล่"
    ) {
      return selectedSpares.length > 0;
    }

    if (actionStatus === "ส่งซ่อมภายนอก") {
      return Boolean(vendorId && vendorId.trim() !== "");
    }

    if (actionStatus === "ไม่สามารถซ่อมได้") {
      return Boolean(formState.unrepairableReason?.trim());
    }

    return true;
  }, [
    formState,
    actionStatus,
    selectedMechanicIds,
    selectedSpares,
    vendorId,
  ]);

  // Handlers
  const handleActionStatusChange = (newStatus: ActionTypeUI) => {
    setActionStatus(newStatus);
    setSelectedSpares([]);
    setVendorId("");
  };

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

  const handleSaveDraft = () => {
    if (!currentJobId) return;

    const draftData = {
      actionStatus,
      formState,
      selectedMechanicIds,
      selectedSpares,
      vendorId,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(draftStorageKey, JSON.stringify(draftData));
    alert("บันทึกแบบร่างเรียบร้อยแล้ว");
    closeForm();
  };

  const submitAssessment = () => {
    if (!selectedJob || !isFormValid || !currentJobId) return;

    const stepActionType = ACTION_TYPE_MAP[actionStatus];
    const selectedDetail = jobDetail;
    if (!selectedDetail) return;

    // คำนวณ DueDate
    let formattedDueDate: string | undefined;
    // The deployed backend currently applies conflicting date validation:
    // DTO validation expects ISO 8601 while the service accepts only YYYY-MM-DD.
    // dueDate is optional, so omit it for tracks that can continue without it.
    if (
      stepActionType !== "UNREPAIRABLE" &&
      stepActionType !== "WITH_PARTS" &&
      formState.dueDate
    ) {
      const days = Number(formState.dueDate);
      if (!isNaN(days) && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        formattedDueDate = `${year}-${month}-${day}`;
      } else {
        const parsedDate = new Date(formState.dueDate);
        if (!isNaN(parsedDate.getTime())) {
          formattedDueDate = String(formState.dueDate).slice(0, 10);
        }
      }
    }

    // สร้าง DTO Object
    const dto: RepairDetailDto = {
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
      companyId: stepActionType === "OUTSOURCE" ? vendorId || null : undefined,
      spareParts:
        stepActionType === "WITH_PARTS"
          ? selectedSpares.map((sp) => ({
              sparepartId: Number(sp.id),
              qty: Number(sp.quantity) || 1,
              stockType: sp.stockType,
            }))
          : undefined,
    };

    // ยิง Mutation
    mutation.mutate(dto);
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
      {/* Top Header Navigation */}
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
            <span className="font-semibold text-emerald-600">
              ประเมินการซ่อม ({displayJobNo})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-md bg-emerald-50 text-emerald-600 text-xs font-bold font-mono">
            {displayJobNo}
          </span>
          <span className="px-3 py-1 rounded-md bg-amber-50 text-amber-600 text-xs font-semibold">
            ● รอดำเนินการประเมิน
          </span>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Asset Details */}
        <div className="lg:col-span-5">
          <AssetInfoCard jobData={selectedJob} />
        </div>

        {/* Right Side: Evaluation Form */}
        <div className="lg:col-span-7 bg-white border border-slate-100 shadow-2xs rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-3">
              <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                <Pencil className="w-4 h-4" />
              </span>
              บันทึกผลการประเมินและการดำเนินการ
            </div>
          </div>

          <CommonEvaluationFields
            actionStatus={ACTION_TYPE_MAP[actionStatus]}
            setActionStatus={(stepAction) => {
              const mapped = REVERSE_ACTION_TYPE_MAP[stepAction];
              if (mapped) handleActionStatusChange(mapped);
            }}
            formState={formState as any}
            setFormState={setFormState as any}
            causes={metaLookups?.causes || []}
            jobTypes={metaLookups?.jobTypes || []}
            techCategories={metaLookups?.techCategories || []}
          />

          <MechanicSelector
            usersList={mechanics}
            selectedMechanicIds={selectedMechanicIds}
            onToggleMechanic={handleToggleMechanic}
          />

          {actionStatus === "ขอเบิกอะไหล่" && (
            <InternalSpareFields
              key={actionStatus}
              selectedSpares={selectedSpares}
              setSelectedSpares={setSelectedSpares}
            />
          )}

          {actionStatus === "ส่งซ่อมภายนอก" && (
            <ExternalVendorFields
              key={actionStatus}
              companyId={vendorId}
              setCompanyId={(id) => setVendorId(id)}
            />
          )}

          {/* Action Buttons */}
          {isDetailError && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
              ไม่สามารถโหลดรายละเอียดใบงานล่าสุดได้ กรุณากลับไปเลือกรายการใหม่
            </p>
          )}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={handleSaveDraft}
              className="px-5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              บันทึกแบบร่าง
            </button>

            <button
              type="button"
              disabled={
                !isFormValid ||
                mutation.isPending ||
                isDetailLoading ||
                isDetailError
              }
              onClick={handleSubmit}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors ${
                isFormValid &&
                !mutation.isPending &&
                !isDetailLoading &&
                !isDetailError
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {mutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {mutation.isPending ? "กำลังบันทึก..." : "บันทึกผลการประเมิน"}
            </button>
          </div>
        </div>
      </div>
      {showUnrepairableReview && (
        <TechnicianConfirmDialog
          title="ยืนยันผลการประเมิน — ไม่สามารถซ่อมได้"
          busy={mutation.isPending}
          error={
            mutation.isError
              ? requestErrorMessage(mutation.error)
              : undefined
          }
          confirmLabel="ยืนยันบันทึกผล"
          onClose={() => {
            if (!mutation.isPending) {
              mutation.reset();
              setShowUnrepairableReview(false);
            }
          }}
          onConfirm={submitAssessment}
        >
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-emerald-700">{displayJobNo}</p>
            <p className="mt-1 font-bold text-slate-800">
              {jobDetail?.asset?.noid} · {jobDetail?.asset?.name}
            </p>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">ผลการวินิจฉัยทางเทคนิค</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                {formState.technicalDiagnosisDetail}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">แนวทางดำเนินการ</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                {formState.solution}
              </dd>
            </div>
          </dl>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle size={17} />
              เหตุผลที่ไม่สามารถซ่อมได้
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words">
              {formState.unrepairableReason}
            </p>
          </div>
          <p className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-700">
            การยืนยันนี้เป็นการบันทึกผลประเมินเท่านั้น ยังไม่ถือว่าส่งคืนครุภัณฑ์ให้พัสดุ
            หลังบันทึกให้ไปที่ “รายการงานซ่อม” และยืนยันส่งคืนเมื่อนำเครื่องไปห้องพัสดุจริง
          </p>
        </TechnicianConfirmDialog>
      )}
    </div>
  );
}
