import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import AssetInfoCard from "./AssetInfoCard";
import CommonEvaluationFields from "./CommonEvaluationFields";
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
  getMechanics,
  getRepairMetaLookups,
} from "../../services/assessmentService";

export type ActionTypeUI =
  | "ซ่อมเองได้"
  | "ขอเบิกอะไหล่ภายใน"
  | "ขอเบิกอะไหล่ภายนอก"
  | "ส่งซ่อมภายนอก"
  | "ขอซื้อทดแทน";

export interface AssessmentFormState {
  symptomCause: string;
  diagnosis?: string;
  solution: string;
  causeId: string | number;
  isRepeatRepair?: boolean;
  dueDate: string | number;
  technicalDiagnosisDetail: string;
}

const INITIAL_FORM_STATE: AssessmentFormState = {
  symptomCause: "",
  diagnosis: "",
  solution: "",
  causeId: "",
  isRepeatRepair: false,
  dueDate: "",
  technicalDiagnosisDetail: "",
};

const ACTION_TYPE_MAP: Record<ActionTypeUI, StepActionType> = {
  ซ่อมเองได้: "SELF_REPAIR",
  ขอเบิกอะไหล่ภายใน: "INTERNAL_STOCK",
  ขอเบิกอะไหล่ภายนอก: "EXTERNAL_STOCK",
  ส่งซ่อมภายนอก: "OUTSOURCE",
  ขอซื้อทดแทน: "PURCHASE_REPLACEMENT",
};

const REVERSE_ACTION_TYPE_MAP: Record<StepActionType, ActionTypeUI> = {
  SELF_REPAIR: "ซ่อมเองได้",
  INTERNAL_STOCK: "ขอเบิกอะไหล่ภายใน",
  EXTERNAL_STOCK: "ขอเบิกอะไหล่ภายนอก",
  OUTSOURCE: "ส่งซ่อมภายนอก",
  PURCHASE_REPLACEMENT: "ขอซื้อทดแทน",
};

const normalizeMechanicIds = (ids: (string | number)[]): string[] => {
  return ids
    .map((id) => String(id).trim())
    .filter(
      (id) => id !== "" && id !== "null" && id !== "undefined" && id !== "NaN",
    );
};

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

  useEffect(() => {
    if (!currentJobId) return;

    const savedDraft = localStorage.getItem(draftStorageKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setActionStatus(parsed.actionStatus || "ซ่อมเองได้");
        setFormState(parsed.formState || INITIAL_FORM_STATE);
        setSelectedMechanicIds(parsed.selectedMechanicIds || []);
        setSelectedSpares(parsed.selectedSpares || []);
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

  // Mutation บันทึกการประเมิน
  const mutation = useMutation({
    mutationFn: async (dto: RepairDetailDto) => {
      if (!currentJobId) return;
      return await createEvaluation(String(currentJobId), dto);
    },
    onSuccess: () => {
      alert("บันทึกผลการประเมินสำเร็จ");
      if (draftStorageKey) {
        localStorage.removeItem(draftStorageKey);
      }
      queryClient.invalidateQueries({ queryKey: ["pendingEvaluations"] });
      queryClient.invalidateQueries({ queryKey: ["repairList"] });
      closeForm();
    },
    onError: (err: unknown) => {
      const errorObj = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const rawMsg = errorObj?.response?.data?.message || errorObj?.message;
      const errorMsg = Array.isArray(rawMsg) ? rawMsg.join(", ") : rawMsg;
      alert(
        `ไม่สามารถทำรายการได้: ${errorMsg || "เกิดข้อผิดพลาดในการบันทึกข้อมูล"}`,
      );
    },
  });

  const isFormValid = useMemo(() => {
    const hasCommonFields =
      Boolean(actionStatus) &&
      Boolean(formState.symptomCause?.trim() || formState.diagnosis?.trim()) &&
      Boolean(formState.solution?.trim()) &&
      Boolean(formState.causeId) &&
      formState.isRepeatRepair !== undefined &&
      Boolean(String(formState.dueDate ?? "").trim()) &&
      selectedMechanicIds.length > 0;

    if (!hasCommonFields) return false;

    if (
      actionStatus === "ขอเบิกอะไหล่ภายใน" ||
      actionStatus === "ขอเบิกอะไหล่ภายนอก"
    ) {
      return selectedSpares.length > 0;
    }

    if (actionStatus === "ส่งซ่อมภายนอก") {
      return Boolean(vendorId && vendorId.trim() !== "");
    }

    return true;
  }, [formState, actionStatus, selectedMechanicIds, selectedSpares, vendorId]);

  // Handlers
  const handleActionStatusChange = (newStatus: ActionTypeUI) => {
    setActionStatus(newStatus);
    setSelectedMechanicIds([]);
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

  const handleSubmit = () => {
    if (!selectedJob || !isFormValid || !currentJobId) return;

    const stepActionType = ACTION_TYPE_MAP[actionStatus];
    const selectedDetail = selectedJob as unknown as RepairDetail;

    // คำนวณ DueDate
    let formattedDueDate = new Date().toISOString();
    if (formState.dueDate) {
      const days = Number(formState.dueDate);
      if (!isNaN(days) && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        formattedDueDate = d.toISOString();
      } else {
        const parsedDate = new Date(formState.dueDate);
        if (!isNaN(parsedDate.getTime())) {
          formattedDueDate = parsedDate.toISOString();
        }
      }
    }

    // สร้าง DTO Object
    const dto: RepairDetailDto = {
      stepActionType: stepActionType,
      actionType: selectedDetail?.actionType || "REPAIR",
      techCategoryId: Number(
        selectedDetail?.techCategoryId || selectedDetail?.asset?.type?.id || 1,
      ),
      jobTypeId: Number(selectedDetail?.jobTypeId || 1),
      diagnosis:
        formState.diagnosis?.trim() || formState.symptomCause?.trim() || "-",
      solution: formState.solution?.trim() || "-",
      causeId: Number(formState.causeId) || 0,
      isRepeatRepair: Boolean(formState.isRepeatRepair),
      dueDate: formattedDueDate,
      mechanicIds: normalizeMechanicIds(selectedMechanicIds),
      companyId: stepActionType === "OUTSOURCE" ? vendorId || null : undefined,
      spareParts:
        stepActionType === "INTERNAL_STOCK" ||
        stepActionType === "EXTERNAL_STOCK"
          ? selectedSpares.map((sp) => ({
              sparepartId: Number(sp.id),
              qty: Number(sp.quantity) || 1,
            }))
          : undefined,
    };

    // ยิง Mutation
    mutation.mutate(dto);
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
          />

          <MechanicSelector
            usersList={mechanics}
            selectedMechanicIds={selectedMechanicIds}
            onToggleMechanic={handleToggleMechanic}
          />

          {(actionStatus === "ขอเบิกอะไหล่ภายใน" ||
            actionStatus === "ขอเบิกอะไหล่ภายนอก") && (
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
              disabled={!isFormValid || mutation.isPending}
              onClick={handleSubmit}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors ${
                isFormValid && !mutation.isPending
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
    </div>
  );
}
