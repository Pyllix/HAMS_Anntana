import { Pencil, Trash2 } from "lucide-react";
import { Department } from "../../../types/TypeDepartment";
import { useState } from "react";
import DialogDelDepartment from "../DialogDelDepartment";
import DialogEditDepartment from "../DialogEditDepartment";

export default function Actions({ row }: { row: Department }) {
  const [isOpenEdit, setIsOpenEdit] = useState(false);
  const [isOpenDelete, setIsOpenDelete] = useState(false);

  return (
    <div className="flex items-center gap-1">
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
        title="ลบ"
        onClick={() => setIsOpenDelete(true)}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <DialogEditDepartment
        isOpen={isOpenEdit}
        onClose={() => setIsOpenEdit(false)}
        department={row}
      />

      <DialogDelDepartment
        isOpen={isOpenDelete}
        onClose={() => setIsOpenDelete(false)}
        department={row}
      />
    </div>
  );
}
