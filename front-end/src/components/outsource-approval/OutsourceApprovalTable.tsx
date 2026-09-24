import { Eye } from "lucide-react";
import type { OutsourceApprovalRequest } from "../../types/TypeOutsourceApproval";

const dateTime = new Intl.DateTimeFormat("th-TH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("th-TH", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default function OutsourceApprovalTable({
  rows,
  onDetail,
  onApprove,
  onReject,
}: {
  rows: OutsourceApprovalRequest[];
  onDetail: (request: OutsourceApprovalRequest) => void;
  onApprove: (request: OutsourceApprovalRequest) => void;
  onReject: (request: OutsourceApprovalRequest) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-xs">
        <thead className="border-b border-slate-100 bg-white text-[11px] font-semibold text-slate-600">
          <tr>
            <th className="px-5 py-4">เลขที่คำขอ</th>
            <th className="px-4 py-4">วันที่ / เวลา</th>
            <th className="px-4 py-4">เลขที่ใบงานซ่อม / ครุภัณฑ์</th>
            <th className="px-4 py-4">ผู้ขอส่งซ่อม (ช่าง)</th>
            <th className="px-4 py-4">กำหนดแล้วเสร็จ</th>
            <th className="px-4 py-4">สถานะ</th>
            <th className="px-4 py-4 text-center">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((request) => (
            <tr key={request.id} className="hover:bg-slate-50/70">
              <td className="px-5 py-5">
                <button
                  type="button"
                  onClick={() => onDetail(request)}
                  className="font-semibold text-sky-600 hover:underline"
                >
                  {request.requestNo}
                </button>
              </td>
              <td className="whitespace-nowrap px-4 py-5 text-slate-600">
                {dateTime.format(new Date(request.requestedAt)).replace(" เวลา ", " · ")} น.
              </td>
              <td className="max-w-[250px] px-4 py-5">
                <button
                  type="button"
                  onClick={() => onDetail(request)}
                  className="font-semibold text-slate-800 hover:text-sky-600"
                >
                  {request.jobNo}
                </button>
                <p className="mt-1 truncate text-[11px] text-slate-500">
                  {request.assetCode} · {request.assetName}
                </p>
              </td>
              <td className="px-4 py-5">
                <p className="font-medium text-slate-800">{request.requester}</p>
                <p className="mt-1 text-[11px] text-slate-500">{request.requesterSection}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-5 text-slate-600">
                {request.dueDate ? dateOnly.format(new Date(request.dueDate)) : "ไม่ระบุ"}
              </td>
              <td className="px-4 py-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  รออนุมัติ
                </span>
              </td>
              <td className="px-4 py-5">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    aria-label={`ดูรายละเอียด ${request.requestNo}`}
                    onClick={() => onDetail(request)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-sky-300 hover:text-sky-600"
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onApprove(request)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
                  >
                    อนุมัติ
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(request)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600"
                  >
                    ปฏิเสธ
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
