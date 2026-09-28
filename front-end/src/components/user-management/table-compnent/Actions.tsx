import { Eye, KeyRound, Pencil, Trash2 } from "lucide-react";
import type { User } from "../../../types/TypeUser";
import { useState } from "react";
import DialogDetailUser from "../DialogDetailUser";
import DialogDelUser from "../DialogDelUser";
import DialogEditUser from "../DialogEditUser";
import DialogAdminSecurityActions from "../DialogAdminSecurityActions";

export default function Actions({ row }: { row: User }) {
  const [isOpenView, setIsOpenView] = useState(false);
  const [isOpenDelete, setIsOpenDelete] = useState(false);
  const [isOpenEdit, setIsOpenEdit] = useState(false);
  const [isOpenSecurity, setIsOpenSecurity] = useState(false);
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
        onClick={() => setIsOpenEdit(true)}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-emerald-600"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="จัดการความปลอดภัยบัญชี"
        aria-label={`จัดการความปลอดภัย ${row.firstname} ${row.lastname}`}
        onClick={() => setIsOpenSecurity(true)}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600"
      >
        <KeyRound className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="ลบ / ระงับ"
        onClick={() => setIsOpenDelete(true)}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <DialogDelUser
        isOpen={isOpenDelete}
        onClose={() => setIsOpenDelete(false)}
        user={row}
      />

      <DialogEditUser
        isOpen={isOpenEdit}
        onClose={() => setIsOpenEdit(false)}
        user={row}
      />

      <DialogDetailUser
        isOpen={isOpenView}
        onClose={() => setIsOpenView(false)}
        user={row}
      />
      <DialogAdminSecurityActions
        isOpen={isOpenSecurity}
        onClose={() => setIsOpenSecurity(false)}
        user={row}
      />
    </div>
  );
}
