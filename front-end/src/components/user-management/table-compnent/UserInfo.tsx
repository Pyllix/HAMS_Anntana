import type { User } from "../../../types/TypeUser";
import EmployeePhotoDisplay from "../../shared/EmployeePhotoDisplay";

export default function UserInfo({
  row,
  fullName,
}: {
  row: User;
  fullName: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Avatar รูปวงกลมตามรูป SVG */}
      <EmployeePhotoDisplay
        userId={row.id}
        hasEmployeePhoto={row.hasEmployeePhoto}
        photoRevision={row.photoRevision}
        alt={fullName}
        containerClassName="relative h-10 w-10 shrink-0 overflow-hidden rounded-full"
        imageClassName="h-10 w-10 rounded-full border border-slate-200 bg-slate-100 object-cover object-center"
        fallbackClassName="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white"
        fallback={row.firstname?.charAt(0) || "U"}
      />

      {/* ชื่อและ username สองบรรทัดแบบสไตล์เก่า */}
      <div className="flex flex-col justify-center min-w-[150px] max-w-[260px] whitespace-normal">
        <span className="font-semibold text-slate-800 leading-snug line-clamp-1">
          {fullName}
        </span>
        <span className="text-xs text-slate-500 font-mono mt-0.5">
          @{row.userName || "-"}
        </span>
      </div>
    </div>
  );
}
