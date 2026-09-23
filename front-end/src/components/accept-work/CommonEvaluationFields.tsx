import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { StepActionType, BaseLookup } from "../../Types/TypeAssessment";
import type { AssessmentFormState } from "./AssessmentForm";

const ACTION_TYPE_LABELS: Record<StepActionType, string> = {
  SELF_REPAIR: "ซ่อมเองได้",
  WITH_PARTS: "ขอเบิกอะไหล่",
  OUTSOURCE: "ส่งซ่อมภายนอก",
  UNREPAIRABLE: "ไม่สามารถซ่อมได้",
};

interface CommonFieldsProps {
  actionStatus: StepActionType;
  setActionStatus: (status: StepActionType) => void;
  formState: AssessmentFormState;
  setFormState: React.Dispatch<React.SetStateAction<AssessmentFormState>>;
  causes?: BaseLookup[];
  jobTypes?: BaseLookup[];
  techCategories?: BaseLookup[];
  readOnly?: boolean;
  isTechCategoryDisabled?: boolean;
}

export default function CommonEvaluationFields({
  actionStatus,
  setActionStatus,
  formState,
  setFormState,
  causes = [],
  jobTypes = [],
  readOnly = false,
}: CommonFieldsProps) {
  const [isCauseOpen, setIsCauseOpen] = useState(false);
  const causeDropdownRef = useRef<HTMLDivElement>(null);

  const [isJobTypeOpen, setIsJobTypeOpen] = useState<boolean>(false);
  const jobTypeDropdownRef = useRef<HTMLDivElement>(null);

  const selectedJobType = jobTypes.find(
    (t) => String(t.id) === String(formState.jobTypeId),
  );

  const selectedCause = causes.find(
    (c) => String(c.id) === String(formState.causeId),
  );

  const actionOptions: StepActionType[] = [
    "SELF_REPAIR",
    "WITH_PARTS",
    "OUTSOURCE",
    "UNREPAIRABLE",
  ];

  const handleChange = <K extends keyof AssessmentFormState>(
    field: K,
    value: AssessmentFormState[K],
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleMultipleChange = (updates: Partial<AssessmentFormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  };

  // ปิด Dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        causeDropdownRef.current &&
        !causeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCauseOpen(false);
      }
      if (
        jobTypeDropdownRef.current &&
        !jobTypeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsJobTypeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* 1. ปุ่มเลือก สถานะการตรวจรักษา / การดำเนินการ */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-2">
          สถานะการตรวจรักษา / การดำเนินการ
          <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl">
          {actionOptions.map((option) => (
            <button
              key={option}
              type="button"
              disabled={readOnly}
              onClick={() => {
                if (!readOnly) setActionStatus(option);
              }}
              className={`py-2 px-1 text-xs font-medium rounded-lg transition-all text-center ${
                readOnly ? "cursor-not-allowed opacity-80" : "cursor-pointer"
              } ${
                actionStatus === option
                  ? "bg-white text-emerald-600 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {ACTION_TYPE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {/* 2. อาการ / สาเหตุ */}
      <div>
        <label
          htmlFor="evaluation-symptom"
          className="text-xs font-semibold text-slate-700 block mb-1.5"
        >
          อาการ / สาเหตุ <span className="text-rose-500">*</span>
        </label>
        <input
          id="evaluation-symptom"
          type="text"
          disabled={readOnly}
          value={formState.symptomCause || formState.diagnosis || ""}
          onChange={(e) => {
            const val = e.target.value;
            handleMultipleChange({
              symptomCause: val,
              diagnosis: val,
            });
          }}
          placeholder="ระบุอาการหรือสาเหตุ..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
        />
      </div>

      {/* 3. วิธีแก้ไข */}
      <div>
        <label
          htmlFor="evaluation-solution"
          className="text-xs font-semibold text-slate-700 block mb-1.5"
        >
          {actionStatus === "UNREPAIRABLE" ? "แนวทางดำเนินการ" : "วิธีแก้ไข"}{" "}
          <span className="text-rose-500">*</span>
        </label>
        <input
          id="evaluation-solution"
          type="text"
          disabled={readOnly}
          value={formState.solution || ""}
          onChange={(e) => handleChange("solution", e.target.value)}
          placeholder={
            actionStatus === "UNREPAIRABLE"
              ? "เช่น ส่งคืนพัสดุเพื่อพักรอจำหน่าย..."
              : "ระบุวิธีแก้ไข..."
          }
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-slate-500  focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
        />
      </div>

      {/* 4. วิเคราะห์สาเหตุ / ประเภทงาน / การซ่อมซ้ำ / ระยะเวลา */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* วิเคราะห์สาเหตุ (Custom Dropdown แสดงสูงสุด 6 รายการ) */}
        <div className="relative" ref={causeDropdownRef}>
          <label
            htmlFor="evaluation-cause"
            className="text-xs font-semibold text-slate-700 block mb-1.5"
          >
            วิเคราะห์สาเหตุ <span className="text-rose-500">*</span>
          </label>
          <button
            id="evaluation-cause"
            type="button"
            disabled={readOnly}
            onClick={() => setIsCauseOpen((prev) => !prev)}
            className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-left flex items-center justify-between bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${
              selectedCause ? "text-slate-700" : "text-slate-400"
            }`}
          >
            <span className="truncate">
              {selectedCause
                ? `${selectedCause.code ? `${selectedCause.code} - ` : ""}${selectedCause.name}`
                : "-- เลือกวิเคราะห์สาเหตุ --"}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          </button>

          {isCauseOpen && !readOnly && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-54 overflow-y-auto py-1">
              <div
                onClick={() => {
                  handleChange("causeId", "");
                  setIsCauseOpen(false);
                }}
                className="px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 cursor-pointer"
              >
                -- เลือกวิเคราะห์สาเหตุ --
              </div>
              {causes.map((cause) => {
                const isSelected =
                  String(cause.id) === String(formState.causeId);
                return (
                  <div
                    key={cause.id}
                    onClick={() => {
                      handleChange("causeId", Number(cause.id));
                      setIsCauseOpen(false);
                    }}
                    className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {cause.code ? `${cause.code} - ` : ""}
                    {cause.name}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ประเภทงาน (Custom Dropdown) */}
        <div className="relative" ref={jobTypeDropdownRef}>
          <label
            htmlFor="evaluation-job-type"
            className="text-xs font-semibold text-slate-700 block mb-1.5"
          >
            ประเภทงาน <span className="text-rose-500">*</span>
          </label>
          <button
            id="evaluation-job-type"
            type="button"
            disabled={readOnly}
            onClick={() => setIsJobTypeOpen((prev) => !prev)}
            className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-left flex items-center justify-between bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${
              selectedJobType ? "text-slate-700" : "text-slate-400"
            }`}
          >
            <span className="truncate">
              {selectedJobType
                ? `${selectedJobType.code ? `${selectedJobType.code} - ` : ""}${selectedJobType.name}`
                : "-- เลือกประเภทงาน --"}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          </button>

          {isJobTypeOpen && !readOnly && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-54 overflow-y-auto py-1">
              <div
                onClick={() => {
                  handleChange("jobTypeId", "");
                  setIsJobTypeOpen(false);
                }}
                className="px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 cursor-pointer"
              >
                -- เลือกประเภทงาน --
              </div>
              {jobTypes.map((type) => {
                const isSelected =
                  String(type.id) === String(formState.jobTypeId);
                return (
                  <div
                    key={type.id}
                    onClick={() => {
                      handleChange("jobTypeId", Number(type.id));
                      setIsJobTypeOpen(false);
                    }}
                    className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {type.code ? `${type.code} - ` : ""}
                    {type.name}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
            การซ่อมซ้ำ <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center gap-4 h-9">
            <label
              className={`flex items-center gap-1.5 text-xs text-slate-600 ${readOnly ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name="isRepeatRepair"
                disabled={readOnly}
                checked={formState.isRepeatRepair === true}
                onChange={() => handleChange("isRepeatRepair", true)}
                className="text-emerald-600 focus:ring-slate-500 disabled:text-slate-400"
              />
              ใช่
            </label>
            <label
              className={`flex items-center gap-1.5 text-xs text-slate-600 ${readOnly ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name="isRepeatRepair"
                disabled={readOnly}
                checked={formState.isRepeatRepair === false}
                onChange={() => handleChange("isRepeatRepair", false)}
                className="text-emerald-600 focus:ring-slate-500 disabled:text-slate-400"
              />
              ไม่
            </label>
          </div>
        </div>

        <div>
          <label
            htmlFor="evaluation-due-date"
            className="text-xs font-semibold text-slate-700 block mb-1.5"
          >
            ระยะเวลาซ่อมโดยประมาณ <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="evaluation-due-date"
              type="number"
              min="0"
              disabled={readOnly}
              value={formState.dueDate || ""}
              onChange={(e) => handleChange("dueDate", e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-200 pl-3 pr-16 py-2 text-xs text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">
              วันทำการ
            </span>
          </div>
        </div>
      </div>

      {actionStatus === "UNREPAIRABLE" && (
        <div>
          <label
            htmlFor="evaluation-unrepairable-reason"
            className="text-xs font-semibold text-slate-700 block mb-1.5"
          >
            เหตุผลที่ไม่สามารถซ่อมได้ <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="evaluation-unrepairable-reason"
            rows={3}
            disabled={readOnly}
            value={formState.unrepairableReason || ""}
            onChange={(e) => handleChange("unrepairableReason", e.target.value)}
            placeholder="เช่น อะไหล่เลิกผลิต ความเสียหายรุนแรง หรือค่าซ่อมไม่คุ้มค่า..."
            className="w-full rounded-lg border border-slate-200 p-3 text-xs text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
          />
        </div>
      )}

      {/* 5. รายละเอียดผลการวินิจฉัยทางเทคนิค */}
      <div>
        <label
          htmlFor="evaluation-technical-diagnosis"
          className="text-xs font-semibold text-slate-700 block mb-1.5"
        >
          รายละเอียดผลการวินิจฉัยทางเทคนิค
          <span className="text-rose-500">*</span>
        </label>
        <textarea
          id="evaluation-technical-diagnosis"
          rows={3}
          disabled={readOnly}
          value={formState.technicalDiagnosisDetail || ""}
          onChange={(e) =>
            handleChange("technicalDiagnosisDetail", e.target.value)
          }
          placeholder="ระบุรายละเอียดทางเทคนิคเพิ่มเติม..."
          className="w-full rounded-lg border border-slate-200 p-3 text-xs text-slate-700  focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
