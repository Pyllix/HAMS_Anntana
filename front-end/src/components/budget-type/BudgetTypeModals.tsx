import React, { useState, useEffect } from "react";
import { X, AlertTriangle, Lock } from "lucide-react";
import type { BudgetType } from "../../Types/TypeBudgetType";

// Helper สำหรับแปลง ID เป็นรหัส BT-xxx
export function formatBudgetCode(id: number | string): string {
  return `BT-${String(id).padStart(3, "0")}`;
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
interface DetailModalProps {
  isOpen: boolean;
  item: BudgetType | null;
  onClose: () => void;
}

export function BudgetTypeDetailModal({
  isOpen,
  item,
  onClose,
}: DetailModalProps) {
  if (!isOpen || !item) return null;

  const isActive = item.isActive !== false;

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
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xl font-bold text-slate-800">
            รายละเอียดประเภทงบประมาณ
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Avatar & Title */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-2xl shrink-0">
            {item.name ? item.name.trim().charAt(0) : "B"}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 leading-tight">
              {item.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isActive
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isActive ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              {isActive ? "ใช้งานปกติ" : "ระงับการใช้งาน"}
            </span>
          </div>
        </div>

        {/* 2-Col Info Box */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5 grid grid-cols-2 gap-4 text-xs sm:text-sm">
          <div>
            <span className="block text-slate-400 text-xs mb-1 font-medium">
              รหัสประเภทเงิน
            </span>
            <span className="font-mono font-bold text-slate-800 text-sm sm:text-base">
              {formatBudgetCode(item.id)}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 text-xs mb-1 font-medium">
              ปีงบประมาณ
            </span>
            <span className="font-bold text-slate-800 text-sm sm:text-base">
              {item.fiscalYear ? String(item.fiscalYear) : "-"}
            </span>
          </div>
        </div>

        {/* Description Section */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            รายละเอียด <span className="text-emerald-600">*</span>
          </label>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-xs sm:text-sm text-slate-700 min-h-[90px] leading-relaxed">
            {item.description || "-"}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form Modal (Add & Edit) ───────────────────────────────────────────────────
interface FormModalProps {
  isOpen: boolean;
  item: BudgetType | null; // null = Add mode, object = Edit mode
  onClose: () => void;
  onSubmit: (formData: {
    name: string;
    fiscalYear?: number;
    description?: string;
    isActive: boolean;
  }) => void;
  isSubmitting?: boolean;
}

export function BudgetTypeFormModal({
  isOpen,
  item,
  onClose,
  onSubmit,
  isSubmitting = false,
}: FormModalProps) {
  const [name, setName] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const isEdit = Boolean(item);

  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setFiscalYear(item.fiscalYear ? String(item.fiscalYear) : "");
      setDescription(item.description || "");
      setIsActive(item.isActive !== false);
    } else {
      setName("");
      setFiscalYear("");
      setDescription("");
      setIsActive(true);
    }
  }, [item, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedYear = fiscalYear.trim() ? Number(fiscalYear.trim()) : undefined;

    onSubmit({
      name: name.trim(),
      fiscalYear: Number.isNaN(parsedYear) ? undefined : parsedYear,
      description: description.trim() || undefined,
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
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {isEdit ? "แก้ไขข้อมูลประเภทเงิน" : "เพิ่มประเภทเงินใหม่"}
            </h2>
            {!isEdit && (
              <p className="text-xs text-slate-400 mt-0.5">
                กรอกข้อมูลรายละเอียดของประเภทเงินใหม่
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Edit Mode: Locked Code */}
          {isEdit && item && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                รหัสประเภทเงิน (ไม่สามารถแก้ไขได้)
              </label>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-100/70 px-3.5 py-2.5 text-sm text-slate-500 font-mono">
                <span>{formatBudgetCode(item.id)}</span>
                <Lock className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          )}

          {/* Row: Name and FiscalYear */}
          {!isEdit ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  ชื่อประเภทเงิน <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น เงินบำรุง"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  ปีงบประมาณ <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="พ.ศ.XXXX"
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>
          ) : (
            <>
              {/* Edit Mode: Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  ชื่อประเภทเงิน <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-emerald-500 px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              {/* Edit Mode: FiscalYear */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  ปีงบประมาณ <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </>
          )}

          {/* Edit Mode: Status placed before Description (matching Mockup 3) */}
          {isEdit && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                สถานะ:
              </label>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="radio"
                    name="isActive"
                    checked={isActive === true}
                    onChange={() => setIsActive(true)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span>ใช้งานปกติ (Active)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="radio"
                    name="isActive"
                    checked={isActive === false}
                    onChange={() => setIsActive(false)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span>ระงับการใช้งาน (Suspend)</span>
                </label>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              รายละเอียด <span className="text-emerald-600">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="-"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
            />
          </div>

          {/* Add Mode: Status placed after Description (matching Mockup 5) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                สถานะ <span className="text-emerald-600">*</span>
              </label>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="radio"
                    name="isActive"
                    checked={isActive === true}
                    onChange={() => setIsActive(true)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span>ใช้งานปกติ (Active)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="radio"
                    name="isActive"
                    checked={isActive === false}
                    onChange={() => setIsActive(false)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span>ระงับการใช้งาน (Suspend)</span>
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSubmitting
                ? "กำลังบันทึก..."
                : isEdit
                ? "บันทึกการเปลี่ยนแปลง"
                : "บันทึกข้อมูล"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
interface DeleteModalProps {
  isOpen: boolean;
  item: BudgetType | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function BudgetTypeDeleteModal({
  isOpen,
  item,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteModalProps) {
  if (!isOpen || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 text-center space-y-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 border border-rose-100">
          <AlertTriangle className="h-8 w-8 stroke-[2.2]" />
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-slate-900">
            ยืนยันการลบประเภทเงิน?
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed px-2">
            คุณแน่ใจหรือไม่ที่จะลบประเภทเงินงานรายนี้ออกจากระบบ
            ข้อมูลประวัติการทำงานจะยังคงถูกเก็บไว้เป็นประวัติการทำรายการ
          </p>
        </div>

        {/* Item Target Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 text-left space-y-1">
          <h4 className="font-bold text-slate-900 text-sm sm:text-base">
            {item.name}
          </h4>
          <p className="text-xs text-slate-500 font-mono truncate">
            {formatBudgetCode(item.id)} • {item.description || "ไม่มีรายละเอียด"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-600 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isDeleting ? "กำลังลบ..." : "ยืนยันการลบข้อมูล"}
          </button>
        </div>

        {/* Disclaimer Note */}
        <p className="text-[11px] text-red-500 pt-1">
          * การกระทำนี้ไม่สามารถย้อนกลับได้
        </p>
      </div>
    </div>
  );
}
