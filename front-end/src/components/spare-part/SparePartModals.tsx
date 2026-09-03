import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  X,
  Plus,
  Lock,
  UploadCloud,
  Printer,
  Trash2,
  MapPin,
  Briefcase,
  BatteryCharging,
  Wrench,
  Calendar,
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Briefcase className="h-5 w-5" />
            </div>
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
                รหัส: {selectedItem.code} | หมวดหมู่: {selectedItem.group?.name || selectedItem.category || "ทั่วไป"} |
                ยี่ห้อ: {selectedItem.brand || "-"}
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50/40">
          {/* Left Column: Image & Location */}
          <div className="md:col-span-4 space-y-4">
            <div className="h-56 w-full rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center p-4 text-center shadow-2xs">
              {selectedItem.imageUrl ? (
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.name}
                  className="h-full w-full object-contain rounded-xl"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-2">
                    {selectedItem.category === "ไฟฟ้า" ? (
                      <BatteryCharging className="h-8 w-8 text-slate-600" />
                    ) : (
                      <Wrench className="h-8 w-8 text-slate-600" />
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    รูปภาพอะไหล่ ({selectedItem.code}.jpg)
                  </span>
                </div>
              )}
            </div>

            {/* Location Card */}
            <div className="rounded-xl bg-white border border-slate-200 p-3.5 flex items-start gap-3 shadow-2xs">
              <div className="p-2 rounded-lg bg-rose-50 text-rose-500 shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-800 mb-0.5">สถานที่จัดเก็บ</p>
                <p className="text-slate-500 leading-relaxed">
                  {selectedItem.storageLocation ||
                    "ตู้เก็บอะไหล่ C, ชั้นวางที่ 2 (โซนอุปกรณ์ไฟฟ้า)"}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Inventory Numbers & Specs */}
          <div className="md:col-span-8 space-y-4">
            {/* Green Summary Box */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-emerald-800 mb-1">
                    คงเหลือในคลัง
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-emerald-600">
                      {selectedItem.qtyInStock}
                    </span>
                    <span className="text-sm font-semibold text-emerald-700">ชิ้น</span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">จุดสั่งซื้อขั้นต่ำ :</span>
                    <span className="font-semibold text-slate-800">
                      {selectedItem.minStock} ชิ้น
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

            {/* Technical Spec & Purchase Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs text-xs space-y-2">
                <p className="font-bold text-slate-800 border-b border-slate-100 pb-2">
                  ข้อมูลเชิงเทคนิค
                </p>
                <div>
                  <p className="text-slate-400">รหัสอ้างอิง</p>
                  <p className="font-medium text-slate-700">{selectedItem.code}</p>
                </div>
                <div>
                  <p className="text-slate-400">รุ่นที่รองรับ</p>
                  <p className="font-medium text-slate-700">
                    {selectedItem.compatibleModel ||
                      "เครื่องสำรองไฟ ขนาด 1000VA ขึ้นไป"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">อายุการใช้งานโดยประมาณ</p>
                  <p className="font-medium text-slate-700">
                    {selectedItem.lifespan || "2 - 3 ปี"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs text-xs space-y-2">
                <p className="font-bold text-slate-800 border-b border-slate-100 pb-2">
                  ข้อมูลวันที่สั่งซื้อ
                </p>
                <div>
                  <p className="text-slate-400">วันที่สั่งซื้อล่าสุด</p>
                  <p className="font-medium text-slate-700">
                    {selectedItem.purchaseDate || "15 ก.พ. 2567"}
                  </p>
                </div>
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
    brand: "",
    price: 0,
    minStock: 0,
    qtyInStock: 0,
    imageUrl: "",
    compatibleModel: "",
    lifespan: "",
    purchaseDate: "",
    storageLocation: "",
  };

  const [form, setForm] = useState<CreateSparepartDto>(empty);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleImageFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPG, PNG, WEBP)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("ขนาดไฟล์ภาพต้องไม่เกิน 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setForm((f) => ({ ...f, imageUrl: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (editItem) {
      setForm({
        code: editItem.code,
        name: editItem.name,
        groupId: editItem.groupId || editItem.group?.id || (availableGroups[0]?.id ?? 1),
        category: editItem.category || editItem.group?.name || availableGroups[0]?.name || "ไฟฟ้า",
        brand: editItem.brand || "",
        price: editItem.price || 0,
        minStock: editItem.minStock || 0,
        qtyInStock: editItem.qtyInStock || 0,
        imageUrl: editItem.imageUrl || "",
        compatibleModel: editItem.compatibleModel || "",
        lifespan: editItem.lifespan || "",
        purchaseDate: editItem.purchaseDate || "",
        storageLocation: editItem.storageLocation || "",
      });
    } else {
      setForm({
        ...empty,
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
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">
                  แก้ไขข้อมูลสต็อกอะไหล่
                </h2>
                <p className="text-xs text-slate-500">
                  จัดการข้อมูลพื้นฐานและปรับปรุงจำนวนคงคลัง
                </p>
              </div>
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
              <div className="md:col-span-5 space-y-4">
                {/* Image Preview Box */}
                <input
                  type="file"
                  ref={editFileInputRef}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                />
                <div
                  onClick={() => editFileInputRef.current?.click()}
                  className="relative h-44 w-full rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/70 transition-colors flex flex-col items-center justify-center p-3 text-center cursor-pointer overflow-hidden group"
                >
                  {form.imageUrl ? (
                    <>
                      <img
                        src={form.imageUrl}
                        alt="Preview"
                        className="h-full w-full object-contain rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                        <UploadCloud className="h-6 w-6 mb-1" />
                        <span className="text-2xs font-medium">คลิกเพื่อเปลี่ยนรูป</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-1.5 group-hover:scale-105 transition-transform">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        คลิกเพื่อเพิ่ม/เปลี่ยนรูปภาพ
                      </span>
                      <span className="text-2xs text-slate-400 mt-0.5">
                        รองรับ JPG, PNG
                      </span>
                    </>
                  )}
                </div>

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
                        ยี่ห้อ
                      </label>
                      <input
                        type="text"
                        value={form.brand}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, brand: e.target.value }))
                        }
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="md:col-span-7 space-y-4">
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
                          ชิ้น
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
                              qtyInStock: f.qtyInStock + 1,
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
                              qtyInStock: Math.max(0, f.qtyInStock - 1),
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
                    <span className="text-slate-500">💲 ราคาต่อหน่วย</span>
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

                {/* Detailed Specs */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-800">ข้อมูลรายละเอียด</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        รุ่นที่รองรับ *
                      </label>
                      <input
                        type="text"
                        value={form.compatibleModel}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            compatibleModel: e.target.value,
                          }))
                        }
                        placeholder="เช่น เครื่องสำรองไฟ ขนาด 1000VA ขึ้นไป"
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        อายุการใช้งาน *
                      </label>
                      <input
                        type="text"
                        value={form.lifespan}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, lifespan: e.target.value }))
                        }
                        placeholder="2 - 3 ปี"
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        วันที่สั่งซื้อ *
                      </label>
                      <input
                        type="date"
                        value={form.purchaseDate}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            purchaseDate: e.target.value,
                          }))
                        }
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        สถานที่จัดเก็บ *
                      </label>
                      <input
                        type="text"
                        value={form.storageLocation}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            storageLocation: e.target.value,
                          }))
                        }
                        placeholder="ตู้เก็บอะไหล่ C, ชั้นวางที่ 2"
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500"
                      />
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

  // ─── Add Mode (Dialog AddStock) ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">เพิ่มอะไหล่ใหม่</h2>
              <p className="text-xs text-slate-500">
                กรอกรายละเอียดข้อมูลอะไหล่เพื่อบันทึกเข้าระบบสต็อก
              </p>
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Image Upload Area */}
            <div className="md:col-span-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  รูปภาพอะไหล่ (ถ้ามี)
                </label>
                {form.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                    className="text-2xs text-rose-500 hover:text-rose-700 font-medium cursor-pointer"
                  >
                    ลบรูปภาพ
                  </button>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={(e) => handleImageFile(e.target.files?.[0])}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleImageFile(e.dataTransfer.files?.[0]);
                }}
                className={`relative h-72 w-full rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer overflow-hidden group ${
                  isDragging
                    ? "border-emerald-500 bg-emerald-100/50 scale-[1.01]"
                    : form.imageUrl
                    ? "border-slate-200 bg-slate-50"
                    : "border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40"
                }`}
              >
                {form.imageUrl ? (
                  <>
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="h-full w-full object-contain rounded-xl"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-2">
                      <UploadCloud className="h-8 w-8 mb-1" />
                      <p className="text-xs font-medium">คลิกเพื่อเปลี่ยนรูป</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3 group-hover:scale-105 transition-transform">
                      <UploadCloud className="h-7 w-7" />
                    </div>
                    <p className="font-semibold text-emerald-800 text-xs mb-1">
                      ลากไฟล์มาวางที่นี่
                    </p>
                    <p className="text-2xs text-slate-500 mb-3">
                      หรือ คลิกเพื่ออัปโหลดรูปภาพ
                    </p>
                    <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-2xs text-slate-500 font-medium">
                      รองรับ JPG, PNG, WEBP
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right Column: Form Fields */}
            <div className="md:col-span-8 space-y-4">
              {/* ข้อมูลพื้นฐาน */}
              <div className="space-y-2.5">
                <p className="text-xs font-bold text-slate-800">ข้อมูลพื้นฐาน</p>
                <div className="grid grid-cols-2 gap-3">
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

                <div className="grid grid-cols-2 gap-3">
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
                      ยี่ห้อ *
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น UPS, Medline"
                      value={form.brand}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, brand: e.target.value }))
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
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      จำนวนรับเข้าครั้งแรก *
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
                        ชิ้น
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
                        ชิ้น
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      ราคาต่อหน่วย
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

              {/* ข้อมูลรายละเอียด */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-800">ข้อมูลรายละเอียด</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      รุ่นที่รองรับ *
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น เครื่องสำรองไฟ ขนาด 1000VA ขึ้นไป"
                      value={form.compatibleModel}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          compatibleModel: e.target.value,
                        }))
                      }
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      อายุการใช้งาน *
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 2 - 3 ปี"
                      value={form.lifespan}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lifespan: e.target.value }))
                      }
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      วันที่สั่งซื้อ *
                    </label>
                    <input
                      type="date"
                      value={form.purchaseDate}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          purchaseDate: e.target.value,
                        }))
                      }
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      สถานที่จัดเก็บ *
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ตู้เก็บอะไหล่ C, ชั้นวางที่ 2"
                      value={form.storageLocation}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          storageLocation: e.target.value,
                        }))
                      }
                      className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500"
                    />
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
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 overflow-hidden text-slate-400 shrink-0">
              {targetItem.imageUrl ? (
                <img
                  src={targetItem.imageUrl}
                  alt={targetItem.name}
                  className="h-full w-full object-cover"
                />
              ) : targetItem.category === "ไฟฟ้า" || targetItem.group?.name === "ไฟฟ้า" ? (
                <BatteryCharging className="h-5 w-5 text-slate-500" />
              ) : (
                <Wrench className="h-5 w-5 text-slate-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{targetItem.name}</p>
              <p className="text-2xs text-slate-500 font-mono">รหัส: {targetItem.code}</p>
            </div>
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
