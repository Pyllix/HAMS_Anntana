import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  X,
  Plus,
  Lock,
  Printer,
  Trash2,
} from "lucide-react";
import {
  useSparePartDetailModalStore,
  useSparePartFormModalStore,
  useSparePartDeleteModalStore,
} from "../../stores/useSparePartModalStore";
import {
  createSparepart,
  updateSparepart,
  deleteSparepart,
  getSparepartGroups,
} from "../../services/sparepartService";
import type { Sparepart, CreateSparepartDto } from "../../Types/TypeSparePart";
import { getSparePartStatus } from "../../Types/TypeSparePart";

// ─── 1. Detail Modal (Dialog DetailStock) ──────────────────────────────────────

export function SparePartDetailModal() {
  const { isOpen, selectedItem, closeModal } = useSparePartDetailModalStore();
  if (!isOpen || !selectedItem) return null;

  const statusMap = {
    NORMAL: {
      label: "ปกติ",
      cls: "border-emerald-200 text-emerald-600 bg-emerald-50/80",
      dot: "bg-emerald-500",
    },
    LOW: {
      label: "ต้องสั่งเพิ่ม",
      cls: "border-amber-200 text-amber-600 bg-amber-50/80",
      dot: "bg-amber-500",
    },
    OUT: {
      label: "ของหมด",
      cls: "border-rose-200 text-rose-600 bg-rose-50/80",
      dot: "bg-rose-500",
    },
  };
  const st = statusMap[getSparePartStatus(selectedItem)];
  const totalValue = (selectedItem.qtyInStock * selectedItem.price).toLocaleString(
    "th-TH",
    { minimumFractionDigits: 0 },
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-bold text-slate-900 text-lg">
                {selectedItem.name}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${st.cls}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                {st.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              รหัส: {selectedItem.code} | หมวดหมู่: {selectedItem.group?.name || selectedItem.category || "ทั่วไป"}
            </p>
          </div>
          <button
            onClick={closeModal}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 bg-slate-50/40">
          {/* Green Summary Box */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-emerald-800 mb-1">
                  คงเหลือในคลัง
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-emerald-600">
                    {selectedItem.qtyInStock}
                  </span>
                  <span className="text-sm font-semibold text-emerald-700">
                    {selectedItem.unit || "ชิ้น"}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">จุดสั่งซื้อขั้นต่ำ :</span>
                  <span className="font-semibold text-slate-800">
                    {selectedItem.minStock} {selectedItem.unit || "ชิ้น"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ราคาต่อหน่วย :</span>
                  <span className="font-semibold text-slate-800">
                    {Number(selectedItem.price).toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    บาท
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-emerald-200/60">
                  <span className="text-emerald-800 font-semibold">
                    มูลค่ารวมในคลัง :
                  </span>
                  <span className="font-bold text-emerald-700">
                    {totalValue} บาท
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timestamps & Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs text-xs space-y-2">
              <p className="font-bold text-slate-800 border-b border-slate-100 pb-2">
                วันที่สร้างรายการ
              </p>
              <div>
                <p className="font-medium text-slate-700">
                  {selectedItem.createdAt
                    ? new Date(selectedItem.createdAt).toLocaleString("th-TH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                    : "-"}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs text-xs space-y-2">
              <p className="font-bold text-slate-800 border-b border-slate-100 pb-2">
                อัปเดตล่าสุด
              </p>
              <div>
                <p className="font-medium text-slate-700">
                  {selectedItem.updatedAt
                    ? new Date(selectedItem.updatedAt).toLocaleString("th-TH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-100 flex justify-end">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            พิมพ์
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 2. Add Modal (Dialog AddStock) ───────────────────────────────────────────

export function SparePartFormModal() {
  const { isOpen, editItem, closeModal } = useSparePartFormModalStore();
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery({
    queryKey: ["sparepartGroups"],
    queryFn: getSparepartGroups,
  });

  const defaultGroups = [
    { id: 1, name: "ไฟฟ้า" },
    { id: 2, name: "เครื่องมือแพทย์" },
    { id: 3, name: "อิเล็กทรอนิกส์" },
    { id: 4, name: "กลไก/เครื่องกล" },
  ];

  const availableGroups = groups.length > 0 ? groups : defaultGroups;

  const empty: CreateSparepartDto = {
    code: "",
    name: "",
    groupId: availableGroups[0]?.id ?? 1,
    category: availableGroups[0]?.name ?? "ไฟฟ้า",
    unit: "ชิ้น",
    price: 0,
    minStock: 0,
    qtyInStock: 0,
  };

  const [form, setForm] = useState<CreateSparepartDto>(empty);

  useEffect(() => {
    if (editItem) {
      setForm({
        code: editItem.code,
        name: editItem.name,
        groupId: editItem.groupId || editItem.group?.id || (availableGroups[0]?.id ?? 1),
        category: editItem.category || editItem.group?.name || availableGroups[0]?.name || "ไฟฟ้า",
        unit: editItem.unit ?? "",
        price: editItem.price || 0,
        minStock: editItem.minStock || 0,
        qtyInStock: editItem.qtyInStock || 0,
      });
    } else {
      setForm({
        ...empty,
        unit: "ชิ้น",
        groupId: availableGroups[0]?.id ?? 1,
        category: availableGroups[0]?.name ?? "ไฟฟ้า",
      });
    }
  }, [editItem, isOpen, groups]);

  const mutation = useMutation({
    mutationFn: (dto: CreateSparepartDto) =>
      editItem ? updateSparepart(editItem.id, dto) : createSparepart(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spareParts"] });
      closeModal();
    },
  });

  if (!isOpen) return null;

  // Render Edit Mode (Dialog EditStock) or Add Mode (Dialog AddStock)
  if (editItem) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
        <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                แก้ไขข้อมูลสต็อกอะไหล่
              </h2>
              <p className="text-xs text-slate-500">
                จัดการข้อมูลพื้นฐานและปรับปรุงจำนวนคงคลัง
              </p>
            </div>
            <button
              onClick={closeModal}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Edit Form Body */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(form);
            }}
            className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column */}
              <div className="md:col-span-6 space-y-4">
                {/* ข้อมูลพื้นฐาน */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-800">ข้อมูลพื้นฐาน</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        รหัสสินค้า
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.code}
                          disabled
                          className="w-full h-8.5 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs text-slate-500 cursor-not-allowed"
                        />
                        <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        สถานะ
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value="● ปกติ"
                          disabled
                          className="w-full h-8.5 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs text-emerald-600 font-semibold cursor-not-allowed"
                        />
                        <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        ชื่ออะไหล่
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, name: e.target.value }))
                        }
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        จุดสั่งซื้อขั้นต่ำ
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={form.minStock === 0 ? "" : form.minStock}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            minStock:
                              e.target.value === "" ? 0 : Number(e.target.value),
                          }))
                        }
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        หมวดหมู่
                      </label>
                      <select
                        value={form.groupId || (availableGroups.find((g) => g.name === form.category)?.id ?? availableGroups[0]?.id ?? 1)}
                        onChange={(e) => {
                          const gid = Number(e.target.value);
                          const g = availableGroups.find((x) => x.id === gid);
                          setForm((f) => ({
                            ...f,
                            groupId: gid,
                            category: g?.name || f.category,
                          }));
                        }}
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      >
                        {availableGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        หน่วยนับ
                      </label>
                      <input
                        type="text"
                        value={form.unit || "ชิ้น"}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, unit: e.target.value }))
                        }
                        placeholder="เช่น ชิ้น, อัน, กล่อง"
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="md:col-span-6 space-y-4">
                {/* Stock Adjustment Box */}
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-emerald-800 mb-1">
                        คงเหลือในคลัง
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-emerald-600">
                          {form.qtyInStock}
                        </span>
                        <span className="text-xs font-semibold text-emerald-700">
                          {form.unit || "ชิ้น"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-2xs font-semibold text-slate-500 text-right">
                        ปรับปรุงยอด
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              qtyInStock: (f.qtyInStock ?? 0) + 1,
                            }))
                          }
                          className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                        >
                          + เพิ่มจำนวน
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              qtyInStock: Math.max(0, (f.qtyInStock ?? 0) - 1),
                            }))
                          }
                          className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                        >
                          - ลดจำนวน
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price Box */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">ราคาต่อหน่วย</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {Number(form.price).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.price === 0 ? "" : form.price}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        price:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      }))
                    }
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 h-9 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="px-5 h-9 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {mutation.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─── Add Mode (Dialog AddStock) ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-base">เพิ่มอะไหล่ใหม่</h2>
            <p className="text-xs text-slate-500">
              กรอกรายละเอียดข้อมูลอะไหล่เพื่อบันทึกเข้าระบบสต็อก
            </p>
          </div>
          <button
            onClick={closeModal}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Add Form Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
        >
          <div className="space-y-4">
            {/* ข้อมูลพื้นฐาน */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-slate-800">ข้อมูลพื้นฐาน</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    รหัสอะไหล่ *
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น EL-BT-001"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value }))
                    }
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    ชื่ออะไหล่ *
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น แบตเตอรี่ UPS"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    หมวดหมู่ *
                  </label>
                  <select
                    value={form.groupId || (availableGroups.find((g) => g.name === form.category)?.id ?? availableGroups[0]?.id ?? 1)}
                    onChange={(e) => {
                      const gid = Number(e.target.value);
                      const g = availableGroups.find((x) => x.id === gid);
                      setForm((f) => ({
                        ...f,
                        groupId: gid,
                        category: g?.name || f.category,
                      }));
                    }}
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:border-emerald-500"
                  >
                    {availableGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    หน่วยนับ *
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ชิ้น, อัน, กล่อง"
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* ข้อมูลสต็อกและราคา */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-800">ข้อมูลสต็อกและราคา</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    จำนวนสต็อกเริ่มต้น *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0"
                      value={form.qtyInStock === 0 ? "" : form.qtyInStock}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          qtyInStock:
                            e.target.value === "" ? 0 : Number(e.target.value),
                        }))
                      }
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-slate-400">
                      {form.unit || "ชิ้น"}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    จุดสั่งซื้อขั้นต่ำ *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0"
                      value={form.minStock === 0 ? "" : form.minStock}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          minStock:
                            e.target.value === "" ? 0 : Number(e.target.value),
                        }))
                      }
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-slate-400">
                      {form.unit || "ชิ้น"}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    ราคาต่อหน่วย *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.price === 0 ? "" : form.price}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          price:
                            e.target.value === "" ? 0 : Number(e.target.value),
                        }))
                      }
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 pr-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-slate-400">
                      บาท
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-5 h-9 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 h-9 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {mutation.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 3. Delete Modal (Dialog DelStock) ────────────────────────────────────────

export function SparePartDeleteModal() {
  const { isOpen, targetItem, closeModal } = useSparePartDeleteModalStore();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteSparepart(targetItem!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spareParts"] });
      closeModal();
    },
  });

  if (!isOpen || !targetItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 text-center">
        {/* Red Circular Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <Trash2 className="h-7 w-7" />
        </div>

        <div>
          <h2 className="font-bold text-slate-900 text-base">
            ยืนยันการลบข้อมูลสต็อกอะไหล่
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?
            <br />
            ข้อมูลที่ถูกลบจะไม่สามารถกู้คืนกลับมาได้
          </p>
        </div>

        {/* Item Preview Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex items-center justify-between text-left">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">{targetItem.name}</p>
            <p className="text-2xs text-slate-500 font-mono">รหัส: {targetItem.code}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0 ml-2">
            <span className="h-1 w-1 rounded-full bg-emerald-500" />
            คงเหลือ {targetItem.qtyInStock} {targetItem.unit || "ชิ้น"}
          </span>
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={closeModal}
            className="flex-1 h-9 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 h-9 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {mutation.isPending ? "กำลังลบ..." : "ลบข้อมูล"}
          </button>
        </div>
      </div>
    </div>
  );
}
