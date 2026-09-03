import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  X,
  UploadCloud,
  FileText,
  Trash2,
  Package,
  Store,
  User,
  PlusCircle,
  FileSpreadsheet,
  ShoppingCart,
} from "lucide-react";
import { usePartOrderModalStore } from "../../stores/usePartOrderModalStore";
import { stockInSparepart, getSpareParts } from "../../services/sparepartService";
import { updateOrderStatus, createPartOrder } from "../../services/partOrderService";
import type { StockInSparepartDto } from "../../Types/TypeSparePart";

// ─── 0. Modal สร้างคำสั่งซื้ออะไหล่ใหม่ (Create Part Order / Stock-In) ─────────

export function PartOrderCreateModal() {
  const { isCreateModalOpen, preselectedSparepartId, closeCreateModal } =
    usePartOrderModalStore();
  const queryClient = useQueryClient();

  const { data: spareParts } = useQuery({
    queryKey: ["spareParts"],
    queryFn: getSpareParts,
    enabled: isCreateModalOpen,
  });

  const [selectedSparepartId, setSelectedSparepartId] = useState<number>(0);
  const [qty, setQty] = useState<number | "">(1);
  const [orderNo, setOrderNo] = useState<string>("");
  const [totalPrice, setTotalPrice] = useState<number>(0);

  const currentPart = spareParts?.find((p) => p.id === selectedSparepartId);

  useEffect(() => {
    if (isCreateModalOpen) {
      const initialId = preselectedSparepartId || spareParts?.[0]?.id || 0;
      setSelectedSparepartId(initialId);
      setOrderNo("");
      setQty(1);
      const matched = spareParts?.find((p) => p.id === initialId);
      setTotalPrice(matched ? Number(matched.price) : 0);
    }
  }, [isCreateModalOpen, preselectedSparepartId, spareParts]);

  const handlePartChange = (id: number) => {
    setSelectedSparepartId(id);
    const matched = spareParts?.find((p) => p.id === id);
    if (matched) {
      const currentQty = typeof qty === "number" ? qty : 0;
      setTotalPrice(Number(matched.price) * currentQty);
    }
  };

  const handleQtyChange = (valStr: string) => {
    if (valStr === "") {
      setQty("");
      setTotalPrice(0);
      return;
    }
    const parsed = parseInt(valStr, 10);
    const val = isNaN(parsed) ? 0 : parsed;
    setQty(val);
    if (currentPart) {
      setTotalPrice(Number(currentPart.price) * val);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!currentPart) return;
      if (!orderNo.trim()) {
        alert("กรุณากรอกเลขที่เอกสาร / ใบสั่งซื้อ");
        throw new Error("Doc No. is required");
      }

      const dto: StockInSparepartDto = {
        sparepartId: currentPart.id,
        qty: Number(qty),
        totalPrice: Number(totalPrice),
        sparepartAddDoc: orderNo.trim(),
      };

      try {
        await stockInSparepart(dto);
      } catch (err) {
        console.warn("Backend stockIn warning:", err);
      }

      await createPartOrder({
        sparepartId: currentPart.id,
        partName: currentPart.name,
        category: currentPart.group?.name || currentPart.category || "ทั่วไป",
        unit: currentPart.unit || "ชิ้น",
        quantity: Number(qty),
        unitPrice: Number(currentPart.price),
        totalPrice: Number(totalPrice),
        orderNo: orderNo.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spareParts"] });
      queryClient.invalidateQueries({ queryKey: ["partOrders"] });
      closeCreateModal();
    },
  });

  if (!isCreateModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-[500px] rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-base">
              สั่งซื้ออะไหล่เพิ่ม (Stock-In)
            </h2>
            <p className="text-2xs text-slate-500">
              ส่งรายการสั่งซื้อเพื่อเพิ่มจำนวนคงคลังในระบบสต็อก
            </p>
          </div>
          <button
            onClick={closeCreateModal}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-6 space-y-4 text-xs"
        >
          {/* 1. เลือกอะไหล่จากรายการสต็อก */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              เลือกอะไหล่ที่ต้องการสั่งซื้อ <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSparepartId}
              onChange={(e) => handlePartChange(Number(e.target.value))}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-hidden transition-all"
              required
            >
              {spareParts?.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.code}] {p.name} (คงเหลือ: {p.qtyInStock} {p.unit || "ชิ้น"})
                </option>
              ))}
            </select>
          </div>

          {/* สรุปข้อมูลอะไหล่ที่เลือก */}
          {currentPart && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-slate-600">
              <div>
                <p className="font-semibold text-slate-800">{currentPart.name}</p>
                <p className="text-2xs text-slate-500 font-mono">
                  หมวดหมู่: {currentPart.group?.name || currentPart.category || "ทั่วไป"} | หน่วย: {currentPart.unit || "ชิ้น"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xs text-slate-400">ราคา/หน่วย</p>
                <p className="font-mono font-bold text-slate-800">
                  {Number(currentPart.price).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
                </p>
              </div>
            </div>
          )}

          {/* 2. เลขที่เอกสารสั่งซื้อ */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              เลขที่เอกสาร / ใบสั่งซื้อ (Doc No.) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น PO-500 หรือ INV-2569-001"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden transition-all shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 3. จำนวนที่สั่งซื้อ */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                จำนวนที่สั่งซื้อ <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="0"
                  value={qty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleQtyChange(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 pr-9 text-xs font-mono font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden transition-all shadow-2xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-slate-400 font-medium">
                  {currentPart?.unit || "ชิ้น"}
                </span>
              </div>
            </div>

            {/* 4. ราคารวมทั้งสิ้น */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                ราคารวมทั้งสิ้น <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={totalPrice === 0 ? "" : totalPrice}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setTotalPrice(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs font-mono font-bold text-emerald-700 focus:border-emerald-500 focus:outline-hidden transition-all shadow-2xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-slate-400 font-medium">
                  บาท
                </span>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end items-center gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={closeCreateModal}
              className="px-5 h-9 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {mutation.isPending ? "กำลังบันทึก..." : "ยืนยันการสั่งซื้อ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 1. Modal รับเข้าสต็อก / เพิ่มจำนวนอะไหล่ (ERD: SPAREPART_ADD) ─────────────

export function PartOrderPurchasingModal() {
  const { isPurchasingModalOpen, selectedOrder, closePurchasingModal } =
    usePartOrderModalStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [qty, setQty] = useState<number>(0);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [sparepartAddDoc, setSparepartAddDoc] = useState<string>("");

  useEffect(() => {
    if (selectedOrder) {
      setQty(selectedOrder.quantity || 1);
      const up = selectedOrder.unitPrice || 0;
      setTotalPrice(up > 0 ? Number((up * (selectedOrder.quantity || 1)).toFixed(2)) : (selectedOrder.totalPrice || 0));
      setSparepartAddDoc(selectedOrder.orderNo || "");
    }
  }, [selectedOrder, isPurchasingModalOpen]);

  const handleQtyChange = (val: number) => {
    setQty(val);
    const up = selectedOrder?.unitPrice || 0;
    if (up > 0) {
      setTotalPrice(Number((val * up).toFixed(2)));
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) return;
      const dto: StockInSparepartDto = {
        sparepartId: selectedOrder.sparepart_id || selectedOrder.id,
        qty: Number(qty),
        totalPrice: Number(totalPrice),
        sparepartAddDoc: sparepartAddDoc || selectedOrder.orderNo,
      };

      try {
        await stockInSparepart(dto);
      } catch (err) {
        console.warn("Backend stock-in warning, proceeding with order update:", err);
      }

      await updateOrderStatus(selectedOrder.id, "RECEIVED");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partOrders"] });
      queryClient.invalidateQueries({ queryKey: ["spareParts"] });
      closePurchasingModal();
    },
  });

  if (!isPurchasingModalOpen || !selectedOrder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-[480px] rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-100 relative">
          <button
            onClick={closePurchasingModal}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                เพิ่มจำนวนอะไหล่ (รับเข้าสต็อก)
              </h2>
              <p className="text-2xs text-slate-500">
                บันทึกรายการรับอะไหล่เข้าคลังและเพิ่มยอดคงเหลือ
              </p>
            </div>
          </div>

          {/* อะไหล่เป้าหมายที่รับเข้า */}
          <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">
                {selectedOrder.partName}
              </span>
              <span className="font-mono font-bold text-slate-700">
                {selectedOrder.orderNo}
              </span>
            </div>
            <div className="flex items-center justify-between text-2xs text-slate-500">
              <span>หมวดหมู่: {selectedOrder.category}</span>
              <span>ผู้ขอเบิก: {selectedOrder.requesterName}</span>
            </div>
          </div>
        </div>

        {/* Form Body ตรงตามโครงสร้าง ERD: SPAREPART_ADD */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="px-6 py-4 space-y-3"
        >
          {/* 1. จำนวนที่รับเข้า (qty: int) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              จำนวนที่รับเข้า (qty) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                required
                placeholder="0"
                value={qty === 0 ? "" : qty}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleQtyChange(parseInt(e.target.value) || 0)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden transition-all shadow-2xs"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-slate-400 font-medium">
                {selectedOrder.unit || "ชิ้น"}
              </span>
            </div>
          </div>

          {/* 2. ราคารวมทั้งสิ้น (total_price: float) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              ราคารวมทั้งสิ้น (total_price) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={totalPrice === 0 ? "" : totalPrice}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setTotalPrice(parseFloat(e.target.value) || 0)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-emerald-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden transition-all shadow-2xs"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-slate-400 font-medium">
                บาท
              </span>
            </div>
          </div>

          {/* 3. เลขที่เอกสารรับเข้า / ใบสั่งซื้อ (sparepart_add_doc: varchar) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              เลขที่เอกสารรับเข้า / ใบสั่งซื้อ (sparepart_add_doc) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น PO-499 หรือ INV-2569-001"
              value={sparepartAddDoc}
              onChange={(e) => setSparepartAddDoc(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden transition-all shadow-2xs"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={closePurchasingModal}
              className="px-5 h-9 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {mutation.isPending ? "กำลังบันทึก..." : "บันทึกรับเข้าสต็อก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 2. Modal ดูรายละเอียดคำสั่งซื้อ (Order Detail Modal) ──────────────────────

export function PartOrderDetailModal() {
  const { isDetailModalOpen, selectedOrder, closeDetailModal } =
    usePartOrderModalStore();

  if (!isDetailModalOpen || !selectedOrder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-base">
                รายละเอียดใบสั่งซื้อ
              </h2>
              <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                {selectedOrder.orderNo}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              ข้อมูลสรุปการสั่งซื้ออะไหล่และการขอเบิก
            </p>
          </div>
          <button
            onClick={closeDetailModal}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <p className="font-bold text-sm text-slate-900">
              {selectedOrder.partName}
            </p>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <p>
                หมวดหมู่: <span className="font-medium text-slate-800">{selectedOrder.category}</span>
              </p>
              <p>
                จำนวน: <span className="font-bold text-emerald-700">{selectedOrder.quantity} {selectedOrder.unit}</span>
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="font-bold text-slate-800">
              ข้อมูลการสั่งซื้อและรับเข้าสต็อก (SPAREPART_ADD)
            </p>
            <div className="space-y-2 text-slate-600 pl-5">
              <div className="flex justify-between">
                <span>เลขที่เอกสารจัดซื้อ:</span>
                <span className="font-mono font-bold text-slate-800">{selectedOrder.orderNo || selectedOrder.sparepart_add_doc || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>จำนวนที่สั่งซื้อ:</span>
                <span className="font-bold text-slate-800">{selectedOrder.quantity} {selectedOrder.unit || "ชิ้น"}</span>
              </div>
              <div className="flex justify-between">
                <span>ราคาต่อหน่วย:</span>
                <span className="font-mono text-slate-800">
                  {selectedOrder.unitPrice ? `${Number(selectedOrder.unitPrice).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท` : "-"}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-1.5">
                <span className="font-semibold text-slate-800">ราคารวมทั้งสิ้น:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {selectedOrder.totalPrice ? `${Number(selectedOrder.totalPrice).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท` : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>วันที่ทำรายการ:</span>
                <span className="text-slate-700">{selectedOrder.orderDate || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>ผู้บันทึกรายการ:</span>
                <span className="text-slate-700">{selectedOrder.requesterName || "เจ้าหน้าที่พัสดุ"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3.5 border-t border-slate-100 bg-slate-50">
          <button
            onClick={closeDetailModal}
            className="px-5 h-8.5 rounded-xl bg-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
