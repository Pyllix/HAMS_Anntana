import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { isAxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSparepartGroup,
  updateSparepartGroup,
} from "../../services/sparepartGroupService";
import type { SparepartGroup } from "../../types/TypeSparePart";

interface Props {
  isOpen: boolean;
  group?: SparepartGroup | null;
  onClose: () => void;
}

// Mount a fresh form whenever the dialog opens or the selected group changes.
export default function SparepartGroupFormDialog({ isOpen, group, onClose }: Props) {
  if (!isOpen) return null;
  return <GroupForm key={group?.id ?? "new"} group={group} onClose={onClose} />;
}

function GroupForm({ group, onClose }: Omit<Props, "isOpen">) {
  const [name, setName] = useState(group?.name ?? "");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const titleId = useId();
  const inputId = useId();
  const errorId = useId();
  const queryClient = useQueryClient();
  const title = group ? "แก้ไขกลุ่มอะไหล่" : "เพิ่มกลุ่มอะไหล่";

  const mutation = useMutation({
    mutationFn: (value: string) => group
      ? updateSparepartGroup(group.id, { name: value })
      : createSparepartGroup({ name: value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sparepartGroups"] });
      void queryClient.invalidateQueries({ queryKey: ["spareParts"] });
      onClose();
    },
    onError: (cause: unknown) => {
      const status = isAxiosError(cause) ? cause.response?.status : undefined;
      setError(status === 409
        ? "ชื่อกลุ่มอะไหล่นี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น"
        : status === 403
          ? "คุณไม่มีสิทธิ์จัดการกลุ่มอะไหล่"
          : status === 404
            ? "ไม่พบกลุ่มอะไหล่นี้ กรุณาปิดหน้าต่างและโหลดรายการใหม่"
            : "ไม่สามารถบันทึกกลุ่มอะไหล่ได้ กรุณาตรวจสอบรายการก่อนลองอีกครั้ง");
    },
    onSettled: () => { submitting.current = false; },
  });

  const close = () => {
    if (!submitting.current) onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    const value = name.trim();
    if (!value || value.length > 100) {
      setError("กรุณาระบุชื่อกลุ่มอะไหล่ 1–100 ตัวอักษร");
      return;
    }
    setError("");
    submitting.current = true;
    mutation.mutate(value);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2937]/60 backdrop-blur-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={mutation.isLoading}
        className="relative w-full max-w-[600px] bg-white rounded-[24px] shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 sm:px-8 sm:py-6 border-b border-[#E5E7EB]">
          <div>
            <h3 id={titleId} className="text-2xl font-bold text-[#1F2937]">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">ระบุชื่อสำหรับจัดหมวดหมู่อะไหล่</p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={mutation.isLoading}
            aria-label="ปิดหน้าต่าง"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="min-h-0 overflow-y-auto p-6 sm:p-8 space-y-5">
          <div>
            <label htmlFor={inputId} className="block text-sm font-bold text-[#1F2937] mb-1.5">
              ชื่อกลุ่มอะไหล่ <span className="text-emerald-600">*</span>
            </label>
            <input
              id={inputId}
              type="text"
              required
              autoFocus
              maxLength={100}
              value={name}
              disabled={mutation.isLoading}
              onChange={(event) => { setName(event.target.value); setError(""); }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              placeholder="เช่น อะไหล่ระบบไฟฟ้า"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900 disabled:bg-gray-50"
            />
          </div>
          {error && <p id={errorId} role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="pt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[#E5E7EB]">
            <button type="button" onClick={close} disabled={mutation.isLoading}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 text-sm font-bold hover:bg-gray-50 disabled:opacity-60">
              ยกเลิก
            </button>
            <button type="submit" disabled={mutation.isLoading}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {mutation.isLoading ? "กำลังบันทึก..." : group ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
