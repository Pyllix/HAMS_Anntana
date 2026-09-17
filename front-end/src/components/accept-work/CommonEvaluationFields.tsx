import type {
  StepActionType,
  RepairDetailDto,
  BaseLookup,
} from "../../Types/TypeAssessment";

const ACTION_TYPE_LABELS: Record<StepActionType, string> = {
  SELF_REPAIR: "ซ่อมเองได้",
  WITH_PARTS: "ขอเบิกอะไหล่",
  INTERNAL_STOCK: "ขอเบิกอะไหล่ภายใน",
  EXTERNAL_STOCK: "ขอเบิกอะไหล่ภายนอก",
  OUTSOURCE: "ส่งซ่อมภายนอก",
  UNREPAIRABLE: "ไม่สามารถซ่อมได้",
};

interface CommonFieldsProps {
  actionStatus: StepActionType;
  setActionStatus: (status: StepActionType) => void;
  formState: RepairDetailDto;
  setFormState: React.Dispatch<React.SetStateAction<RepairDetailDto>>;
  causes?: BaseLookup[];
  jobTypes?: BaseLookup[];
  techCategories?: BaseLookup[];
}

export default function CommonEvaluationFields({
  actionStatus,
  setActionStatus,
  formState,
  setFormState,
  causes = [],
  jobTypes = [],
  techCategories = [],
}: CommonFieldsProps) {
  const actionOptions: StepActionType[] = [
    "SELF_REPAIR",
    "WITH_PARTS",
    "OUTSOURCE",
    "UNREPAIRABLE",
  ];

  const handleChange = <K extends keyof RepairDetailDto>(
    field: K,
    value: RepairDetailDto[K],
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleMultipleChange = (updates: Partial<RepairDetailDto>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="space-y-4">
      {/* 1. ปุ่มเลือก สถานะการตรวจรักษา / การดำเนินการ */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-2">
          สถานะการตรวจรักษา / การดำเนินการ
          <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl">
          {actionOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setActionStatus(option);
                handleChange("stepActionType", option);
              }}
              className={`py-2 px-1 text-xs font-medium rounded-lg transition-all text-center cursor-pointer ${
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
        <label htmlFor="evaluation-symptom" className="text-xs font-semibold text-slate-700 block mb-1.5">
          อาการ / สาเหตุ <span className="text-rose-500">*</span>
        </label>
        <input
          id="evaluation-symptom"
          type="text"
          value={formState.symptomCause || formState.diagnosis || ""}
          onChange={(e) => {
            const val = e.target.value;
            handleMultipleChange({
              symptomCause: val,
              diagnosis: val,
            });
          }}
          placeholder="ระบุอาการหรือสาเหตุ..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* 3. วิธีแก้ไข */}
      <div>
        <label htmlFor="evaluation-solution" className="text-xs font-semibold text-slate-700 block mb-1.5">
          {actionStatus === "UNREPAIRABLE" ? "แนวทางดำเนินการ" : "วิธีแก้ไข"} <span className="text-rose-500">*</span>
        </label>
        <input
          id="evaluation-solution"
          type="text"
          value={formState.solution || ""}
          onChange={(e) => handleChange("solution", e.target.value)}
          placeholder={actionStatus === "UNREPAIRABLE" ? "เช่น ส่งคืนพัสดุเพื่อพักรอจำหน่าย..." : "ระบุวิธีแก้ไข..."}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* 4. วิเคราะห์สาเหตุ / การซ่อมซ้ำ / ระยะเวลา */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="evaluation-cause" className="text-xs font-semibold text-slate-700 block mb-1.5">
            วิเคราะห์สาเหตุ <span className="text-rose-500">*</span>
          </label>
          <select
            id="evaluation-cause"
            value={formState.causeId || ""}
            onChange={(e) => handleChange("causeId", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
          >
            <option value="" disabled>
              -- เลือกวิเคราะห์สาเหตุ --
            </option>
            {causes.map((cause) => (
              <option key={cause.id} value={cause.id}>
                {cause.code ? `${cause.code} - ` : ""}
                {cause.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="evaluation-job-type" className="text-xs font-semibold text-slate-700 block mb-1.5">
            ประเภทงาน <span className="text-rose-500">*</span>
          </label>
          <select
            id="evaluation-job-type"
            value={formState.jobTypeId || ""}
            onChange={(e) => handleChange("jobTypeId", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
          >
            <option value="" disabled>-- เลือกประเภทงาน --</option>
            {jobTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="evaluation-tech-category" className="text-xs font-semibold text-slate-700 block mb-1.5">
            หมวดงานช่าง <span className="text-rose-500">*</span>
          </label>
          <select
            id="evaluation-tech-category"
            value={formState.techCategoryId || ""}
            onChange={(e) => handleChange("techCategoryId", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
          >
            <option value="" disabled>-- เลือกหมวดงานช่าง --</option>
            {techCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.code ? `${category.code} - ` : ""}{category.name}
              </option>
            ))}
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
                name="isRepeatRepair"
                checked={formState.isRepeatRepair === true}
                onChange={() => handleChange("isRepeatRepair", true)}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              ใช่
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="radio"
                name="isRepeatRepair"
                checked={formState.isRepeatRepair === false}
                onChange={() => handleChange("isRepeatRepair", false)}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              ไม่
            </label>
          </div>
        </div>

        {actionStatus !== "UNREPAIRABLE" && <div>
          <label htmlFor="evaluation-due-date" className="text-xs font-semibold text-slate-700 block mb-1.5">
            ระยะเวลาซ่อมโดยประมาณ <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="evaluation-due-date"
              type="number"
              min="0"
              value={formState.dueDate || ""}
              onChange={(e) => handleChange("dueDate", e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-200 pl-3 pr-16 py-2 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">
              วันทำการ
            </span>
          </div>
        </div>}
      </div>

      {actionStatus === "UNREPAIRABLE" && (
        <div>
          <label htmlFor="evaluation-unrepairable-reason" className="text-xs font-semibold text-slate-700 block mb-1.5">
            เหตุผลที่ไม่สามารถซ่อมได้ <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="evaluation-unrepairable-reason"
            rows={3}
            value={formState.unrepairableReason || ""}
            onChange={(e) => handleChange("unrepairableReason", e.target.value)}
            placeholder="เช่น อะไหล่เลิกผลิต ความเสียหายรุนแรง หรือค่าซ่อมไม่คุ้มค่า..."
            className="w-full rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-xs text-slate-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
          />
        </div>
      )}

      {/* 5. รายละเอียดผลการวินิจฉัยทางเทคนิค */}
      <div>
        <label htmlFor="evaluation-technical-diagnosis" className="text-xs font-semibold text-slate-700 block mb-1.5">
          รายละเอียดผลการวินิจฉัยทางเทคนิค
          <span className="text-rose-500">*</span>
        </label>
        <textarea
          id="evaluation-technical-diagnosis"
          rows={3}
          value={formState.technicalDiagnosisDetail || ""}
          onChange={(e) =>
            handleChange("technicalDiagnosisDetail", e.target.value)
          }
          placeholder="ระบุรายละเอียดทางเทคนิคเพิ่มเติม..."
          className="w-full rounded-lg border border-slate-200 p-3 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
        />
      </div>
    </div>
  );
}
