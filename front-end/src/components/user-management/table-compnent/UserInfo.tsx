import type { User } from "../../../types/TypeUser";

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
      <div className="relative h-10 w-10 shrink-0">
        {row.imageUrl ? (
          <img
            src={row.imageUrl}
            alt={fullName}
            className="h-10 w-10 rounded-full object-cover object-center bg-slate-100 border border-slate-200"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white">
            {row.firstname?.charAt(0) || "U"}
          </div>
        )}
      </div>

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
