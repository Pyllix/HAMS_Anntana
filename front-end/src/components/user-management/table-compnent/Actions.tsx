import { Eye, Pencil, Trash2 } from "lucide-react";
import { User } from "../../../types/TypeUser";
import { useState } from "react";
import DialogDetailUser from "../DialogDetailUser";

export default function Actions({ row }: { row: User }) {
  const [isOpenView, setIsOpenView] = useState(false);

  const handleEdit = () => {
    // ใส่ logic เปิด modal แก้ไขผู้ใช้
    console.log("Edit user:", row);
  };

  const handleDelete = () => {
    // ใส่ logic ระงับหรือลบผู้ใช้
    console.log("Delete user:", row);
  };
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        title="ดูข้อมูล"
        onClick={() => setIsOpenView(true)}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <Eye className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="แก้ไข"
        onClick={handleEdit}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-emerald-600"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="ลบ / ระงับ"
        onClick={handleDelete}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <DialogDetailUser
        isOpen={isOpenView}
        onClose={() => setIsOpenView(false)}
        user={row}
      />
    </div>
  );
}
