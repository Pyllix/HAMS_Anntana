import { Package } from "lucide-react";
import type { UnrepairableReceipt } from "../../Types/TypeUnrepairableReceipt";
import { receiptDate } from "../../services/unrepairableReceiptMapper";

export function ReceiptAssetImage({ src }: { src: string | null }) {
  return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
    <Package size={25} aria-hidden="true" className={src ? "absolute" : ""} />
    {src && <img src={src} alt="" className="relative h-full w-full rounded-lg object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
  </div>;
}

export default function UnrepairableReceiptTable({ rows, onConfirm }: {
  rows: UnrepairableReceipt[];
  onConfirm: (job: UnrepairableReceipt) => void;
}) {
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[850px] text-left text-sm">
      <thead className="bg-[#e5e5e5] text-xs text-slate-800"><tr>
        <th className="px-5 py-5">รหัสครุภัณฑ์</th><th className="px-4 py-5">ชื่อครุภัณฑ์</th>
        <th className="px-4 py-5">เลขที่ใบงานซ่อม</th><th className="px-4 py-5">ช่างผู้ส่งคืน</th>
        <th className="px-4 py-5">วันที่ส่งคืน</th><th className="px-4 py-5 text-center">การดำเนินการ</th>
      </tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map((job) => <tr key={job.id} className="hover:bg-slate-50/70">
        <td className="px-5 py-6"><div className="flex items-center gap-4"><ReceiptAssetImage src={job.imageUrl} /><span className="font-semibold">{job.assetCode}</span></div></td>
        <td className="max-w-64 px-4 py-6"><p className="font-semibold">{job.assetName}</p><p className="mt-1 text-xs text-slate-500">{job.model}</p></td>
        <td className="px-4 py-6"><button type="button" onClick={() => onConfirm(job)} className="font-medium text-sky-600 hover:underline" aria-label={`ดูรายละเอียดงาน ${job.jobNo}`}>{job.jobNo}</button></td>
        <td className="px-4 py-6"><p>{job.sender}</p><p className="mt-1 text-xs text-slate-500">{job.technicianCategory}</p></td>
        <td className="whitespace-nowrap px-4 py-6"><p>{receiptDate(job.sentAt)}</p><p className="mt-1 text-xs text-slate-500">{receiptDate(job.sentAt, true)} น.</p></td>
        <td className="px-4 py-6 text-center"><button type="button" onClick={() => onConfirm(job)} aria-label={`ยืนยันรับคืน ${job.assetCode}`} className="rounded bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">ยืนยัน</button></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
