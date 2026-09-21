import { useState, useEffect } from "react";
import { X, AlertTriangle, FileText } from "lucide-react";
import type { AcqType } from "../../types/TypeAcqType";

// Helper สำหรับแปลง ID เป็นรหัส ACQ-xxx
export function formatAcqCode(id: number | string): string {
  return `ACQ-${String(id).padStart(3, "0")}`;
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
interface DetailModalProps {
  isOpen: boolean;
  item: AcqType | null;
  onClose: () => void;
}

export function AcqTypeDetailModal({ isOpen, item, onClose }: DetailModalProps) {
  if (!isOpen || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-800">
            รายละเอียดวิธีการได้มา
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info Header: Circle Avatar + Name + Status Badge */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <FileText className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                item.isActive
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  item.isActive ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              {item.isActive ? "ใช้งานปกติ" : "ระงับการใช้งาน"}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              รหัสวิธีการได้มา
            </label>
            <div className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-semibold text-slate-800 font-mono">
              {formatAcqCode(item.id)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              รายละเอียด *
            </label>
            <div className="w-full min-h-24 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {item.description || "-"}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-6 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form Modal (Add / Edit) ──────────────────────────────────────────────────
interface FormModalProps {
  isOpen: boolean;
  item: AcqType | null; // null = Add, non-null = Edit
  onClose: () => void;
  onSubmit: (formData: {
    name: string;
    description: string;
    isActive: boolean;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function AcqTypeFormModal({
  isOpen,
  item,
  onClose,
  onSubmit,
  isLoading = false,
}: FormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setDescription(item.description || "");
      setIsActive(item.isActive ?? true);
    } else {
      setName("");
      setDescription("");
      setIsActive(true);
    }
  }, [item, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      isActive,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-800">
            {item ? "แก้ไขวิธีการได้มา" : "เพิ่มวิธีการได้มาใหม่"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {item && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                รหัสวิธีการได้มา
              </label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm font-mono text-slate-500">
                {formatAcqCode(item.id)}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              ชื่อวิธีการได้มา <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น ซื้อ, รับโอน, บริจาค..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              รายละเอียด
            </label>
            <textarea
              rows={3}
              placeholder="กรอกคำอธิบายเพิ่มเติม..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-4 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              สถานะการใช้งาน
            </label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="isActive"
                  checked={isActive === true}
                  onChange={() => setIsActive(true)}
                  className="accent-emerald-600 h-4 w-4 cursor-pointer"
                />
                <span className="text-slate-700 font-medium">ใช้งานปกติ</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="isActive"
                  checked={isActive === false}
                  onChange={() => setIsActive(false)}
                  className="accent-emerald-600 h-4 w-4 cursor-pointer"
                />
                <span className="text-slate-700 font-medium">ระงับการใช้งาน</span>
              </label>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────
interface DeleteModalProps {
  isOpen: boolean;
  item: AcqType | null;
  onClose: () => void;
  onConfirm: (id: number) => Promise<void>;
  isLoading?: boolean;
}

export function AcqTypeDeleteModal({
  isOpen,
  item,
  onClose,
  onConfirm,
  isLoading = false,
}: DeleteModalProps) {
  if (!isOpen || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <AlertTriangle className="h-8 w-8 stroke-[2.2]" />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-slate-900">
            ยืนยันการลบวิธีการได้มา?
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed px-4">
            คุณแน่ใจหรือไม่ที่จะลบวิธีการได้มารายการนี้ออกจากระบบ
            ข้อมูลประวัติการทำงานจะยังคงถูกเก็บไว้เป็นประวัติการทำรายการ
          </p>
        </div>

        {/* Preview Card */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left">
          <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
          <p className="text-xs text-slate-400 mt-1 truncate">
            {formatAcqCode(item.id)} • {item.description || "ไม่มีรายละเอียด"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onConfirm(item.id)}
            className="rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? "กำลังลบ..." : "ยืนยันการลบข้อมูล"}
          </button>
        </div>

        {/* Footnote */}
        <p className="text-[11px] text-rose-500">
          * การกระทำนี้ไม่สามารถย้อนกลับได้
        </p>
      </div>
    </div>
  );
}
