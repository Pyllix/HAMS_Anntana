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
  getSparePartTimestamp,
} from "../../services/sparepartService";
import type { Sparepart, CreateSparepartDto } from "../../types/TypeSparePart";
import { getSparePartStatus } from "../../types/TypeSparePart";

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

  const ts = getSparePartTimestamp(selectedItem.id);
  const rawCreatedAt =
    selectedItem.createdAt && selectedItem.createdAt !== "-"
      ? selectedItem.createdAt
      : ts?.createdAt;
  const rawUpdatedAt =
    selectedItem.updatedAt && selectedItem.updatedAt !== "-"
      ? selectedItem.updatedAt
      : ts?.updatedAt || rawCreatedAt;

  const formatDateTime = (val?: string) => {
    if (!val || val === "-") return "-";
    const d = new Date(val);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
                  {formatDateTime(rawCreatedAt)}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs text-xs space-y-2">
              <p className="font-bold text-slate-800 border-b border-slate-100 pb-2">
                อัปเดตล่าสุด
              </p>
              <div>
                <p className="font-medium text-slate-700">
                  {formatDateTime(rawUpdatedAt)}
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
  const [priceInput, setPriceInput] = useState<string>("");

  useEffect(() => {
    if (editItem) {
      const currentPrice = editItem.price ?? 0;
      setForm({
        code: editItem.code,
        name: editItem.name,
        groupId: editItem.groupId || editItem.group?.id || (availableGroups[0]?.id ?? 1),
        category: editItem.category || editItem.group?.name || availableGroups[0]?.name || "ไฟฟ้า",
        unit: editItem.unit ?? "",
        price: currentPrice,
        minStock: editItem.minStock || 0,
        qtyInStock: editItem.qtyInStock || 0,
      });
      setPriceInput(currentPrice > 0 ? String(currentPrice) : "");
    } else {
      setForm({
        ...empty,
        unit: "ชิ้น",
        groupId: availableGroups[0]?.id ?? 1,
        category: availableGroups[0]?.name ?? "ไฟฟ้า",
      });
      setPriceInput("");
    }
  }, [editItem, isOpen, groups]);

  const timerRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);
  const speedRef = useRef<number>(200);

  const stopTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    timeoutRef.current = null;
    timerRef.current = null;
  };

  const startAdjusting = (delta: number) => {
    // 1. Trigger immediately once
    setForm((f) => ({
      ...f,
      qtyInStock: Math.max(0, (f.qtyInStock ?? 0) + delta),
    }));

    stopTimer();
    speedRef.current = 200; // initial interval: 200ms

    // Run after hold for 300ms
    timeoutRef.current = setTimeout(() => {
      const step = () => {
        setForm((f) => ({
          ...f,
          qtyInStock: Math.max(0, (f.qtyInStock ?? 0) + delta),
        }));
        // Accelerate: shorten delay down to 30ms for super fast changes
        speedRef.current = Math.max(30, speedRef.current * 0.85);
        timerRef.current = setTimeout(step, speedRef.current);
      };
      step();
    }, 300);
  };

  useEffect(() => {
    return () => stopTimer();
  }, []);

  const handleIntegerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Enter", "Home", "End"].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }
    // Block non-digits (including +, -, ., e, E)
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handlePriceChange = (val: string) => {
    const clean = val.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;

    setPriceInput(clean);
    const parsed = parseFloat(clean);
    setForm((f) => ({
      ...f,
      price: isNaN(parsed) ? 0 : parsed,
    }));
  };

  const handlePriceBlur = () => {
    if (!priceInput || priceInput === ".") {
      setPriceInput("");
      setForm((f) => ({ ...f, price: 0 }));
      return;
    }
    const parsed = parseFloat(priceInput);
    if (!isNaN(parsed)) {
      setForm((f) => ({ ...f, price: parsed }));
    }
  };

  const handleDecimalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Enter", "Home", "End"].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }
    // Block +, -, e, E
    if (["+", "-", "e", "E"].includes(e.key)) {
      e.preventDefault();
      return;
    }
    // Only allow one decimal point
    if (e.key === ".") {
      const { selectionStart, selectionEnd, value } = e.currentTarget;
      const selectedText =
        selectionStart !== null && selectionEnd !== null
          ? value.slice(selectionStart, selectionEnd)
          : "";
      const valueWithoutSelection = value.replace(selectedText, "");
      if (valueWithoutSelection.includes(".")) {
        e.preventDefault();
      }
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleIntegerPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData("text");
    if (!/^\d+$/.test(paste.trim())) {
      e.preventDefault();
    }
  };

  const handleDecimalPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData("text").trim();
    if (!/^\d*(\.\d{1,2})?$/.test(paste) && !/^\.\d{1,2}$/.test(paste)) {
      e.preventDefault();
    }
  };

  const mutation = useMutation({
    mutationFn: async (dto: CreateSparepartDto) => {
      if (editItem) {
        return await updateSparepart(editItem.id, dto);
      } else {
        return await createSparepart(dto);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spareParts"] });
      closeModal();
    },
    onError: (err: any) => {
      console.error("Mutation failed:", err);
      // Even if backend fails, update locally so user is never blocked
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
              if (!form.name.trim()) {
                alert("กรุณากรอกชื่ออะไหล่");
                return;
              }
              const finalPrice = priceInput ? parseFloat(priceInput) || 0 : 0;
              if (Number(form.minStock) < 0 || finalPrice < 0 || Number(form.qtyInStock) < 0) {
                alert("กรุณากรอกตัวเลขจำนวนและราคาเป็นค่าบวก (ตั้งแต่ 0 ขึ้นไป)");
                return;
              }
              mutation.mutate({ ...form, price: finalPrice });
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
                        ชื่ออะไหล่ <span className="text-rose-500 font-bold ml-1">*</span>
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
                        จุดสั่งซื้อขั้นต่ำ <span className="text-rose-500 font-bold ml-1">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={form.minStock === 0 ? "" : form.minStock}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={handleIntegerKeyDown}
                        onPaste={handleIntegerPaste}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/\D/g, "");
                          setForm((f) => ({
                            ...f,
                            minStock: clean === "" ? 0 : parseInt(clean, 10),
                          }));
                        }}
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        หมวดหมู่ <span className="text-rose-500 font-bold ml-1">*</span>
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
                        หน่วยนับ <span className="text-rose-500 font-bold ml-1">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.unit || "ชิ้น"}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, unit: e.target.value }))
                        }
                        placeholder="เช่น ชิ้น, อัน, กล่อง"
                        className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        required
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
                          onMouseDown={() => startAdjusting(1)}
                          onMouseUp={stopTimer}
                          onMouseLeave={stopTimer}
                          onTouchStart={() => startAdjusting(1)}
                          onTouchEnd={stopTimer}
                          className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-2xs cursor-pointer select-none"
                        >
                          + เพิ่มจำนวน
                        </button>
                        <button
                          type="button"
                          onMouseDown={() => startAdjusting(-1)}
                          onMouseUp={stopTimer}
                          onMouseLeave={stopTimer}
                          onTouchStart={() => startAdjusting(-1)}
                          onTouchEnd={stopTimer}
                          className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-2xs cursor-pointer select-none"
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
                    <span className="text-slate-600 font-medium">
                      ราคาต่อหน่วย <span className="text-rose-500 font-bold ml-1">*</span>
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {(priceInput ? parseFloat(priceInput) || 0 : form.price || 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={priceInput}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={handleDecimalKeyDown}
                    onPaste={handleDecimalPaste}
                    onBlur={handlePriceBlur}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500"
                    required
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
            if (!form.name.trim()) {
              alert("กรุณากรอกชื่ออะไหล่");
              return;
            }
            const finalPrice = priceInput ? parseFloat(priceInput) || 0 : 0;
            if (Number(form.qtyInStock) < 0 || Number(form.minStock) < 0 || finalPrice < 0) {
              alert("กรุณากรอกตัวเลขจำนวนและราคาเป็นค่าบวก (ตั้งแต่ 0 ขึ้นไป)");
              return;
            }
            mutation.mutate({ ...form, price: finalPrice });
          }}
          className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
        >
          <div className="space-y-4">
            {/* ข้อมูลพื้นฐาน */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-slate-800">ข้อมูลพื้นฐาน</p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  ชื่ออะไหล่ <span className="text-rose-500 font-bold ml-1">*</span>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    หมวดหมู่ <span className="text-rose-500 font-bold ml-1">*</span>
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
                    หน่วยนับ <span className="text-rose-500 font-bold ml-1">*</span>
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
                    จำนวนสต็อกเริ่มต้น <span className="text-rose-500 font-bold ml-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={form.qtyInStock === 0 ? "" : form.qtyInStock}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={handleIntegerKeyDown}
                      onPaste={handleIntegerPaste}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, "");
                        setForm((f) => ({
                          ...f,
                          qtyInStock: clean === "" ? 0 : parseInt(clean, 10),
                        }));
                      }}
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
                    จุดสั่งซื้อขั้นต่ำ <span className="text-rose-500 font-bold ml-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={form.minStock === 0 ? "" : form.minStock}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={handleIntegerKeyDown}
                      onPaste={handleIntegerPaste}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, "");
                        setForm((f) => ({
                          ...f,
                          minStock: clean === "" ? 0 : parseInt(clean, 10),
                        }));
                      }}
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
                    ราคาต่อหน่วย <span className="text-rose-500 font-bold ml-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={priceInput}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={handleDecimalKeyDown}
                      onPaste={handleDecimalPaste}
                      onBlur={handlePriceBlur}
                      onChange={(e) => handlePriceChange(e.target.value)}
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
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 text-center">
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
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 break-words whitespace-normal leading-relaxed">
              {targetItem.name}
            </p>
            <p className="text-2xs text-slate-500 font-mono mt-0.5">
              รหัส: {targetItem.code}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0 self-start sm:self-center">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
