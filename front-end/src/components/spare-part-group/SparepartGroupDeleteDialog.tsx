import { useId, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { isAxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteSparepartGroup } from "../../services/sparepartGroupService";
import type { SparepartGroup } from "../../types/TypeSparePart";

interface Props {
  isOpen: boolean;
  group: SparepartGroup | null;
  onClose: () => void;
}

export default function SparepartGroupDeleteDialog({ isOpen, group, onClose }: Props) {
  if (!isOpen || !group) return null;
  return <DeleteConfirmation key={group.id} group={group} onClose={onClose} />;
}

function DeleteConfirmation({ group, onClose }: { group: SparepartGroup; onClose: () => void }) {
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const queryClient = useQueryClient();
  const hasParts = (group.sparepartsCount ?? 0) > 0;

  const mutation = useMutation({
    mutationFn: () => deleteSparepartGroup(group.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sparepartGroups"] });
      onClose();
    },
    onError: (cause: unknown) => {
      const status = isAxiosError(cause) ? cause.response?.status : undefined;
      setError(status === 400
        ? "ไม่สามารถลบได้ เนื่องจากยังมีอะไหล่ผูกกับกลุ่มนี้ กรุณาโหลดรายการใหม่"
        : status === 403
          ? "คุณไม่มีสิทธิ์ลบกลุ่มอะไหล่"
          : status === 404
            ? "ไม่พบกลุ่มอะไหล่นี้ กรุณาปิดหน้าต่างและโหลดรายการใหม่"
            : "ไม่สามารถลบกลุ่มอะไหล่ได้ กรุณาตรวจสอบรายการก่อนลองอีกครั้ง");
      if (status === 400 || status === 404) {
        void queryClient.invalidateQueries({ queryKey: ["sparepartGroups"] });
      }
    },
    onSettled: () => { submitting.current = false; },
  });

  const close = () => {
    if (!submitting.current) onClose();
  };

  const confirm = () => {
    if (submitting.current || hasParts) return;
    setError("");
    submitting.current = true;
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs"
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
        aria-describedby={descriptionId}
        aria-busy={mutation.isLoading}
        className="relative w-full max-w-[576px] max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-6 sm:p-8 shadow-2xl"
      >
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 border-8 border-red-500/10">
          <TriangleAlert className="h-10 w-10 text-red-500" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div className="text-center mb-6">
          <h3 id={titleId} className="text-2xl font-bold text-gray-900">ยืนยันการลบกลุ่มอะไหล่?</h3>
          <p id={descriptionId} className="text-sm text-gray-500 mt-2 leading-relaxed">
            คุณต้องการลบกลุ่มอะไหล่นี้ออกจากรายการใช่หรือไม่
          </p>
          <div className="mt-5 py-4 px-5 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-sm font-bold text-gray-900 break-words">{group.name}</p>
            {group.sparepartsCount !== undefined && (
              <p className="mt-1 text-sm text-gray-500">
                อะไหล่ในกลุ่ม {group.sparepartsCount.toLocaleString("th-TH")} รายการ
              </p>
            )}
          </div>
        </div>
        {error && <p role="alert" className="mb-4 text-sm text-red-600 text-center">{error}</p>}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
          <button
            type="button"
            autoFocus
            onClick={close}
            disabled={mutation.isLoading}
            className="flex-1 rounded-xl border border-gray-300 bg-white py-3.5 px-4 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={mutation.isLoading || hasParts}
            className="flex-1 rounded-xl bg-red-500 py-3.5 px-4 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {mutation.isLoading ? "กำลังลบ..." : "ยืนยันการลบข้อมูล"}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-red-500 leading-relaxed">
          {hasParts
            ? "กลุ่มนี้ยังมีอะไหล่ผูกอยู่ กรุณาย้ายอะไหล่ไปกลุ่มอื่นก่อนลบ"
            : "ลบได้เฉพาะกลุ่มที่ไม่มีอะไหล่ผูกอยู่ โดยระบบจะตรวจสอบอีกครั้งก่อนลบ"}
        </p>
      </div>
    </div>
  );
}
