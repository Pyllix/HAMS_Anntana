import { useState, useEffect, useMemo } from "react";
import { X, AlertTriangle, Pencil, Lock, ChevronDown } from "lucide-react";
import type { Company } from "../../Types/TypeCompany";

// ─── Detail Modal (Image 3) ──────────────────────────────────────────────────
interface DetailModalProps {
  isOpen: boolean;
  item: Company | null;
  onClose: () => void;
  onEdit: (item: Company) => void;
}

export function CompanyDetailModal({
  isOpen,
  item,
  onClose,
  onEdit,
}: DetailModalProps) {
  if (!isOpen || !item) return null;

  const initialLetter =
    item.name && item.name.trim().length > 0
      ? item.name.trim().charAt(0).toUpperCase()
      : "C";

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
            รายละเอียดผู้ผลิต/บริษัท
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Company Avatar & Identity */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-2xl shrink-0">
            {initialLetter}
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 truncate">
              {item.name}
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              ID: {String(item.id).padStart(3, "0")} | รหัส: {item.code}
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isActive
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
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

        {/* Details Grid (Matching Mockup 3) */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs sm:text-sm">
          <div>
            <span className="block text-slate-400 text-xs mb-0.5 font-medium">
              เบอร์โทรศัพท์
            </span>
            <span className="font-semibold text-slate-800">
              {item.tel || "-"}
            </span>
          </div>

          <div className="sm:row-span-2">
            <span className="block text-slate-400 text-xs mb-0.5 font-medium">
              ที่อยู่สถานประกอบการ
            </span>
            <span className="text-slate-700 whitespace-pre-wrap leading-relaxed">
              {item.address || "-"}
            </span>
          </div>

          <div>
            <span className="block text-slate-400 text-xs mb-0.5 font-medium">
              เบอร์แฟกซ์
            </span>
            <span className="font-semibold text-slate-800">
              {item.fax || "-"}
            </span>
          </div>

          <div>
            <span className="block text-slate-400 text-xs mb-0.5 font-medium">
              หมวดหมู่
            </span>
            <span className="font-semibold text-slate-800">
              {item.group || "-"}
            </span>
          </div>

          <div>
            <span className="block text-slate-400 text-xs mb-0.5 font-medium">
              หมายเหตุ
            </span>
            <span className="text-slate-600">
              {item.remark || "-"}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(item);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            <Pencil className="h-4 w-4" />
            <span>แก้ไขข้อมูล</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form Modal (Add / Edit - Matching Image 1) ──────────────────────────────
interface FormModalProps {
  isOpen: boolean;
  item: Company | null; // null = Add, non-null = Edit
  onClose: () => void;
  onSubmit: (formData: {
    code: string;
    name: string;
    tel: string;
    fax: string;
    group: string;
    address: string;
    remark: string;
    isActive: boolean;
  }) => Promise<void>;
  isLoading?: boolean;
  availableGroups?: string[];
}

export function CompanyFormModal({
  isOpen,
  item,
  onClose,
  onSubmit,
  isLoading = false,
  availableGroups = [],
}: FormModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [fax, setFax] = useState("");
  const [group, setGroup] = useState("");
  const [address, setAddress] = useState("");
  const [remark, setRemark] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (item) {
      setCode(item.code || "");
      setName(item.name || "");
      setTel(item.tel || "");
      setFax(item.fax || "");
      setGroup(item.group || availableGroups[0] || "");
      setAddress(item.address || "");
      setRemark(item.remark || "");
      setIsActive(item.isActive !== false);
    } else {
      setCode("");
      setName("");
      setTel("");
      setFax("");
      setGroup(availableGroups[0] || "");
      setAddress("");
      setRemark("");
      setIsActive(true);
    }
  }, [item, isOpen, availableGroups]);

  // Merge unique available groups strictly from backend + current item's group
  const allGroupOptions = useMemo(() => {
    const set = new Set<string>();
    availableGroups.forEach((g) => {
      if (g && g.trim()) set.add(g.trim());
    });
    if (group && group.trim()) {
      set.add(group.trim());
    }
    return Array.from(set);
  }, [availableGroups, group]);

  if (!isOpen) return null;

  const isFormValid = Boolean(code.trim() && name.trim() && tel.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    await onSubmit({
      code: code.trim(),
      name: name.trim(),
      tel: tel.trim(),
      fax: fax.trim(),
      group: group.trim(),
      address: address.trim(),
      remark: remark.trim(),
      isActive,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xl font-bold text-slate-800">
            {item ? "แก้ไขข้อมูลผู้ผลิต/บริษัท" : "เพิ่มผู้ผลิต/บริษัทใหม่"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: ID (disabled) + Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                ID บริษัท (ไม่สามารถแก้ไขได้)
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={item ? String(item.id).padStart(3, "0") : "สร้างอัตโนมัติ"}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm font-mono text-slate-500 cursor-not-allowed"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสบริษัท <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น 001, C001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
              />
            </div>
          </div>

          {/* Row 2: Company Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ชื่อผู้ผลิต / บริษัท <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น บริษัท เอ็ม บี ดี เซอร์จิคอล ซัพพลาย จำกัด"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
            />
          </div>

          {/* Row 3: Phone & Fax */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เบอร์โทร <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น 012-345-6789"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                เบอร์แฟกซ์
              </label>
              <input
                type="text"
                placeholder="เช่น 038-123-4567"
                value={fax}
                onChange={(e) => setFax(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Row 4: Group / Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หมวดหมู่
            </label>
            <div className="relative">
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-10 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all appearance-none cursor-pointer"
              >
                {allGroupOptions.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Row 5: Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ที่อยู่ของบริษัท
            </label>
            <textarea
              rows={2}
              placeholder="กรอกที่อยู่สถานประกอบการ..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
            />
          </div>

          {/* Row 6: Remark */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หมายเหตุ
            </label>
            <input
              type="text"
              placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)..."
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Row 7: Account Status Radio buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              สถานะบัญชี
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
                <span className="text-slate-700 font-medium text-xs sm:text-sm">
                  ใช้งานปกติ (Active)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="isActive"
                  checked={isActive === false}
                  onChange={() => setIsActive(false)}
                  className="accent-emerald-600 h-4 w-4 cursor-pointer"
                />
                <span className="text-slate-700 font-medium text-xs sm:text-sm">
                  ระงับการใช้งาน (Suspend)
                </span>
              </label>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
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
              disabled={isLoading || !isFormValid}
              className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isLoading
                ? "กำลังบันทึก..."
                : item
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
  item: Company | null;
  onClose: () => void;
  onConfirm: (id: string | number) => Promise<void>;
  isLoading?: boolean;
}

export function CompanyDeleteModal({
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
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertTriangle className="h-8 w-8 stroke-[2.2]" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            ยืนยันการลบข้อมูลผู้ผลิต/บริษัท
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลผู้ผลิต/บริษัทนี้?
          </p>
        </div>

        {/* Item summary card */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-1 text-center">
          <p className="text-xs font-mono font-semibold text-slate-400">
            รหัส: {item.code}
          </p>
          <p className="text-sm font-bold text-slate-800">{item.name}</p>
          {item.group && (
            <p className="text-xs text-slate-500">หมวดหมู่: {item.group}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onConfirm(item.id)}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isLoading ? "กำลังลบ..." : "ยืนยันการลบ"}
          </button>
        </div>
      </div>
    </div>
  );
}
