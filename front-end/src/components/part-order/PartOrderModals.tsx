import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
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
} from "lucide-react";
import { usePartOrderModalStore } from "../../stores/usePartOrderModalStore";
import { stockInSparepart } from "../../services/sparepartService";
import { updateOrderStatus } from "../../services/partOrderService";
import type { StockInSparepartDto } from "../../Types/TypeSparePart";

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
      setQty(0);
      setTotalPrice(0);
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
        sparepartId: selectedOrder.id,
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Package className="h-5 w-5" />
            </div>
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
            <p className="font-bold text-slate-800 flex items-center gap-1.5">
              <User className="h-4 w-4 text-slate-500" />
              ข้อมูลผู้ขอเบิก
            </p>
            <div className="grid grid-cols-2 gap-2 text-slate-600 pl-5">
              <p>ผู้ขอเบิก: <span className="font-medium text-slate-800">{selectedOrder.requesterName}</span></p>
              <p>หน่วยงาน: <span className="font-medium text-slate-800">{selectedOrder.department}</span></p>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="font-bold text-slate-800 flex items-center gap-1.5">
              <Store className="h-4 w-4 text-slate-500" />
              ข้อมูลการจัดซื้อ (SPAREPART_ADD)
            </p>
            <div className="space-y-1.5 text-slate-600 pl-5">
              <p>ยี่ห้อ/รุ่น: <span className="font-medium text-slate-800">{selectedOrder.brandModel || "-"}</span></p>
              <p>ร้านค้า/บริษัท: <span className="font-medium text-slate-800">{selectedOrder.supplier || "-"}</span></p>
              <p>ราคาต่อหน่วย: <span className="font-mono text-slate-800">{selectedOrder.unitPrice ? `${selectedOrder.unitPrice.toLocaleString()} บาท` : "-"}</span></p>
              <p>ราคารวมทั้งสิ้น: <span className="font-mono font-bold text-emerald-700">{selectedOrder.totalPrice ? `${selectedOrder.totalPrice.toLocaleString()} บาท` : "-"}</span></p>
              <p>เอกสารแนบ: <span className="font-medium text-slate-800">{selectedOrder.sparepart_add_doc || "-"}</span></p>
              <p>หมายเหตุ: <span className="font-medium text-slate-800">{selectedOrder.note || "-"}</span></p>
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
