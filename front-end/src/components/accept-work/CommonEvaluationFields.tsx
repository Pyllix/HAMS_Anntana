import React from "react";
import type {
  ActionType,
  AssessmentFormState,
} from "../../Types/TypeAssessment";

export type { ActionType };

interface CommonFieldsProps {
  actionStatus: ActionType;
  setActionStatus: (status: ActionType) => void;
  formState: AssessmentFormState;
  setFormState: React.Dispatch<React.SetStateAction<AssessmentFormState>>;
}

export const CommonEvaluationFields: React.FC<CommonFieldsProps> = ({
  actionStatus,
  setActionStatus,
  formState,
  setFormState,
}) => {
  const actionOptions: ActionType[] = [
    "ซ่อมเองได้",
    "ขอเบิกอะไหล่ภายใน",
    "ขอเบิกอะไหล่ภายนอก",
    "ส่งซ่อมภายนอก",
    "ขอซื้อทดแทน",
  ];

  // Helper function สำหรับอัปเดต Field ใน Form แบบ Type-safe
  const handleChange = <K extends keyof AssessmentFormState>(
    field: K,
    value: AssessmentFormState[K],
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      {/* 1. ปุ่มเลือก สถานะการตรวจรักษา / การดำเนินการ */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-2">
          สถานะการตรวจรักษา / การดำเนินการ{" "}
          <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl">
          {actionOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setActionStatus(option)}
              className={`py-2 px-1 text-xs font-medium rounded-lg transition-all text-center cursor-pointer ${
                actionStatus === option
                  ? "bg-white text-emerald-600 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* 2. อาการ / สาเหตุ */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
          อาการ / สาเหตุ <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={formState.symptomCause || ""}
          onChange={(e) => handleChange("symptomCause", e.target.value)}
          placeholder="ระบุอาการหรือสาเหตุ..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* 3. วิธีแก้ไข */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
          วิธีแก้ไข <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={formState.solution || ""}
          onChange={(e) => handleChange("solution", e.target.value)}
          placeholder="ระบุวิธีแก้ไข..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* 4. วิเคราะห์สาเหตุ / การซ่อมซ้ำ / ระยะเวลา */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
            วิเคราะห์สาเหตุ <span className="text-rose-500">*</span>
          </label>
          <select
            value={formState.causeCategory || ""}
            onChange={(e) => handleChange("causeCategory", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
          >
            <option value="" disabled>
              -- เลือกวิเคราะห์สาเหตุ --
            </option>
            <option value="อุปกรณ์เสื่อมสภาพตามอายุ">
              อุปกรณ์เสื่อมสภาพตามอายุ
            </option>
            <option value="การใช้งานผิดวิธี">การใช้งานผิดวิธี</option>
            <option value="ภัยธรรมชาติ/กระแสไฟ">ภัยธรรมชาติ/กระแสไฟ</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
            การซ่อมซ้ำ <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center gap-4 h-9">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="radio"
                name="isRepeat"
                checked={formState.isRepeat === true}
                onChange={() => handleChange("isRepeat", true)}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              ใช่
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="radio"
                name="isRepeat"
                checked={formState.isRepeat === false}
                onChange={() => handleChange("isRepeat", false)}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              ไม่
            </label>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
            ระยะเวลาซ่อมโดยประมาณ <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              value={formState.estimatedDays || ""}
              onChange={(e) =>
                handleChange(
                  "estimatedDays",
                  e.target.value ? Number(e.target.value) : "",
                )
              }
              placeholder="0"
              className="w-full rounded-lg border border-slate-200 pl-3 pr-16 py-2 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">
              วันทำการ
            </span>
          </div>
        </div>
      </div>

      {/* 5. รายละเอียดผลการวินิจฉัยทางเทคนิค */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
          รายละเอียดผลการวินิจฉัยทางเทคนิค{" "}
          <span className="text-rose-500">*</span>
        </label>
        <textarea
          rows={3}
          value={formState.technicalDiagnosis || ""}
          onChange={(e) => handleChange("technicalDiagnosis", e.target.value)}
          placeholder="ระบุรายละเอียดทางเทคนิคเพิ่มเติม..."
          className="w-full rounded-lg border border-slate-200 p-3 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
        />
      </div>
    </div>
  );
};

export default CommonEvaluationFields;
