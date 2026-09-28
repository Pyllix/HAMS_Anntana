import { ChevronDown } from "lucide-react";
import { ROLES, RoleType } from "../../router/roles";

const ROLE_LABELS: Record<RoleType, string> = {
  [ROLES.ADMIN]: "ผู้ดูแลระบบ",
  [ROLES.MANAGER]: "ผู้จัดการ / หัวหน้างาน",
  [ROLES.MAINTENANCE_HEAD]: "หัวหน้าช่างซ่อมบำรุง",
  [ROLES.MAINTENANCE_STAFF]: "ช่างซ่อมบำรุง",
  [ROLES.ASSET_CENTER_STAFF]: "เจ้าหน้าที่ครุภัณฑ์",
  [ROLES.PARCEL_STAFF]: "เจ้าหน้าที่พัสดุ",
  [ROLES.DEPARTMENT_STAFF]: "เจ้าหน้าที่ประจำแผนก",
};

interface Props {
  value: RoleType | "";
  onChange: (value: RoleType | "") => void;
}

export default function RoleFilter({ value, onChange }: Props) {
  return (
    <div className="relative flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 pl-4 pr-9 text-sm text-slate-700">
      <span className="pointer-events-none">ระดับผู้ใช้:</span>
      <span className="pointer-events-none font-bold text-emerald-600">
        {value ? ROLE_LABELS[value] : "ทั้งหมด"}
      </span>
      <select
        aria-label="กรองระดับผู้ใช้"
        value={value}
        onChange={(e) => onChange(e.target.value as RoleType | "")}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        <option value="">ทั้งหมด</option>
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <option key={role} value={role}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[#1F2937]/40" />
    </div>
  );
}
