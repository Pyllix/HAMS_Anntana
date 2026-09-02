import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import AssetInfoCard from "./AssetInfoCard";
import CommonEvaluationFields from "./CommonEvaluationFields";
import InternalSpareFields from "./InternalSpareFields";
import ExternalVendorFields from "./ExternalVendorFields";
import MechanicSelector from "./MechanicSelector";
import { useAssessmentStore } from "../../stores/useAssessmentStore";
import type { SpareItem } from "./InternalSpareFields";
import type {
  EvaluationDto,
  EvaluationSpareDto,
  ActionTypeUI,
  AssessmentFormState,
} from "../../Types/TypeAssessment";
import type { User } from "../../Types/TypeUser";
import { createEvaluation, getUsers } from "../../services/assessmentService";

const INITIAL_FORM_STATE: AssessmentFormState = {
  symptomCause: "",
  solution: "",
  causeCategory: "",
  isRepeat: undefined,
  estimatedDays: "",
  technicalDiagnosis: "",
};

const normalizeMechanicIds = (ids: (string | number)[]): string[] => {
  return ids
    .map((id) => String(id).trim())
    .filter(
      (id) => id !== "" && id !== "null" && id !== "undefined" && id !== "NaN",
    );
};

const normalizeSpares = (spares: SpareItem[]): EvaluationSpareDto[] => {
  return (spares || []).map((item) => ({
    sparepartId: Number(item.id) || 0,
    qty: Number(item.quantity) || 1,
    unitPrice: Number(item.price) || 0,
  }));
};

export default function AssessmentForm() {
  const queryClient = useQueryClient();

  const selectedJob = useAssessmentStore((state) => state.selectedJob);
  const closeForm = useAssessmentStore((state) => state.closeForm);

  const [actionStatus, setActionStatus] = useState<ActionTypeUI>("ซ่อมเองได้");
  const [formState, setFormState] =
    useState<AssessmentFormState>(INITIAL_FORM_STATE);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedMechanicIds, setSelectedMechanicIds] = useState<
    (string | number)[]
  >([]);
  const [selectedSpares, setSelectedSpares] = useState<SpareItem[]>([]);
  const [vendorId, setVendorId] = useState<string>("");

  const currentJobId = selectedJob?.jobId;
  const draftStorageKey = `draft_assessment_${currentJobId}`;

  // 1. Reset State หรือโหลดข้อมูลแบบร่างจาก localStorage เมื่อเปลี่ยน Job
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
  const { mutate: handleEvaluationSubmit, isPending: isSubmitting } =
    useMutation({
      mutationFn: createEvaluation,
      onSuccess: () => {
        alert("บันทึกผลการประเมินสำเร็จ");
        if (currentJobId) {
          localStorage.removeItem(draftStorageKey);
        }
        queryClient.invalidateQueries({ queryKey: ["pendingEvaluations"] });
        closeForm();
      },
      onError: (err: unknown) => {
        const errorObj = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        const errorMsg =
          errorObj?.response?.data?.message ||
          errorObj?.message ||
          "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
        alert(`ไม่สามารถทำรายการได้: ${errorMsg}`);
      },
    });

  // ดึงรายชื่อผู้ใช้งาน
  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      try {
        const res = await getUsers();
        const list: User[] = Array.isArray(res)
          ? res
          : (res as { data: User[] })?.data || [];
        if (isMounted) setUsersList(list);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };

    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  // Form Validation Logic
  const isFormValid = useMemo(() => {
    const hasCommonFields =
      Boolean(actionStatus) &&
      Boolean(formState.symptomCause?.trim()) &&
      Boolean(formState.solution?.trim()) &&
      Boolean(formState.technicalDiagnosis?.trim()) &&
      Boolean(formState.causeCategory) &&
      formState.isRepeat !== undefined &&
      Boolean(String(formState.estimatedDays ?? "").trim()) &&
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
    if (!selectedJob || !isFormValid) return;

    const cleanMechanicIds = normalizeMechanicIds(selectedMechanicIds);
    const cleanVendorId = Number(vendorId) || undefined;

    const dto: EvaluationDto = {
      jobId: selectedJob.jobId,
      actionType: actionStatus,
      diagnosis: formState.symptomCause?.trim(),
      solution: formState.solution?.trim(),
      causeCategory: formState.causeCategory,
      isRepeatRepair: Boolean(formState.isRepeat),
      dueDate: String(formState.estimatedDays).trim(),
      technicalDiagnosis: formState.technicalDiagnosis?.trim(),
      assigneeIds: cleanMechanicIds,
      ...(actionStatus === "ขอเบิกอะไหล่ภายใน" ||
      actionStatus === "ขอเบิกอะไหล่ภายนอก"
        ? { spares: normalizeSpares(selectedSpares) }
        : {}),
      ...(actionStatus === "ส่งซ่อมภายนอก"
        ? {
            companyId: cleanVendorId,
            vendorId: cleanVendorId,
          }
        : {}),
    };

    handleEvaluationSubmit(dto);
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
              ประเมินการซ่อม ({selectedJob.jobNo || `JOB-${selectedJob.jobId}`})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-md bg-emerald-50 text-emerald-600 text-xs font-bold font-mono">
            {selectedJob.jobNo || `JOB-${selectedJob.jobId}`}
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
                ✏️
              </span>
              บันทึกผลการประเมินและการดำเนินการ
            </div>
          </div>

          <CommonEvaluationFields
            actionStatus={actionStatus}
            setActionStatus={handleActionStatusChange}
            formState={formState}
            setFormState={setFormState}
          />

          <MechanicSelector
            usersList={usersList}
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
              vendorId={vendorId}
              setVendorId={setVendorId}
            />
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveDraft}
              className="px-5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              บันทึกแบบร่าง
            </button>

            <button
              type="button"
              disabled={!isFormValid || isSubmitting}
              onClick={handleSubmit}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors ${
                isFormValid && !isSubmitting
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? "กำลังบันทึก..." : "บันทึกผลการประเมิน"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
