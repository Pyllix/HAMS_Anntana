import {
  AlertTriangle,
  Clock,
  Loader2,
  Package,
  Repeat,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBorrowRecommendations } from "../../services/borrowService";
import { useBorrowRecommendationStore } from "../../stores/useBorrowRecommendationStore";
import type { Asset } from "../../types/TypeAsset";
import type { BorrowRecommendationCandidate } from "../../types/TypeBorrow";

interface Option {
  asset: Asset;
  // null = ไม่มีข้อมูลการใช้งานจาก service (เช่น เครื่องที่กดเลือกไม่ติดอันดับที่ดึงมา)
  metrics: BorrowRecommendationCandidate | null;
}

interface Props {
  // ครุภัณฑ์ที่ผู้ใช้ยืมได้จริงในหน้านั้น (service แนะนำข้ามแผนกได้ จึงต้องกรองด้วยรายการนี้)
  pool: Asset[];
  // ไปต่อขั้นตอนการยืมปกติด้วยเครื่องที่เลือก
  onProceed: (asset: Asset) => void;
}

function buildReason(m: BorrowRecommendationCandidate): string {
  if (m.usageDays90d === 0 && m.borrowCount90d === 0) {
    return "ยังไม่มีประวัติการยืมในรอบ 90 วัน พร้อมใช้งาน";
  }
  return `ใช้งานเพียง ${m.usageDays90d.toFixed(1)} วันในรอบ 90 วัน และจอดพักมาแล้ว ${Math.floor(m.idleDays)} วัน เหมาะสำหรับการหมุนเวียนใช้งาน`;
}

export default function BorrowRecommendationDialog({ pool, onProceed }: Props) {
  const { clickedAsset, close } = useBorrowRecommendationStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["borrowRecommendations", clickedAsset?.id],
    queryFn: () =>
      getBorrowRecommendations({ assetId: clickedAsset!.id, limit: 50 }),
    enabled: !!clickedAsset,
    staleTime: 0,
  });

  // เรียงตามอันดับจาก service และเก็บเฉพาะเครื่องที่อยู่ใน pool
  const options: Option[] = useMemo(() => {
    if (!clickedAsset || !data) return [];
    const poolById = new Map(pool.map((a) => [a.id, a]));
    const ranked: Option[] = data.candidates.flatMap((c) => {
      const asset = poolById.get(c.assetId);
      return asset ? [{ asset, metrics: c }] : [];
    });
    if (!ranked.some((o) => o.asset.id === clickedAsset.id)) {
      ranked.push({ asset: clickedAsset, metrics: null });
    }
    return ranked;
  }, [clickedAsset, data, pool]);

  const recommendedId = options[0]?.asset.id;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveSelectedId = selectedId ?? recommendedId ?? clickedAsset?.id;

  const proceed = (asset: Asset) => {
    close();
    onProceed(asset);
  };

  // ไม่มีเครื่องอื่นให้เลือก -> ข้าม Dialog ไปขั้นตอนยืมปกติเลย
  const nothingToChoose = !!data && options.length <= 1;
  useEffect(() => {
    if (nothingToChoose && clickedAsset) proceed(clickedAsset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nothingToChoose]);

  if (!clickedAsset || nothingToChoose) return null;

  const selectedOption = options.find(
    (o) => o.asset.id === effectiveSelectedId,
  );

  return (
    <div
      className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={close}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="borrow-recommendation-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-7 pb-4">
          <div>
            <h2
              id="borrow-recommendation-title"
              className="text-xl font-bold text-gray-800"
            >
              เลือกครุภัณฑ์ที่แนะนำ
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              เพื่อกระจายการใช้งาน ระบบจัดอันดับเครื่องรุ่นเดียวกันที่ใช้งานน้อยและจอดพักนานที่สุดไว้ด้านบน
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 sm:px-8 py-2 flex-1 min-h-0 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังค้นหาเครื่องที่แนะนำ...
            </div>
          )}

          {isError && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
              <span>
                ไม่สามารถโหลดรายการแนะนำได้ในขณะนี้
                คุณยังสามารถยืมเครื่องที่เลือกไว้ต่อได้ตามปกติ
              </span>
            </div>
          )}

          {!!data && (
            <ul className="flex flex-col gap-2.5" role="radiogroup">
              {options.map(({ asset, metrics }) => {
                const isSelected = asset.id === effectiveSelectedId;
                const isRecommended = asset.id === recommendedId;
                const isClicked = asset.id === clickedAsset.id;
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedId(asset.id)}
                      className={`w-full text-left flex items-start gap-3.5 p-4 rounded-xl border transition-colors ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? "border-emerald-600" : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-emerald-600" />
                        )}
                      </span>

                      <div className="w-12 h-12 bg-white rounded-lg border border-gray-200/80 shrink-0 flex items-center justify-center overflow-hidden">
                        {asset.imageUrl ? (
                          <img
                            src={asset.imageUrl}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-gray-400" />
                        )}
                      </div>

                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isRecommended && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Sparkles className="w-3 h-3" />
                              แนะนำ
                            </span>
                          )}
                          {isClicked && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              เครื่องที่คุณเลือก
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2">
                          {asset.name}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono truncate">
                          {asset.noid ? `${asset.noid} | ` : ""}S/N:{" "}
                          {asset.serialNo || "-"} | Model: {asset.model || "-"}
                        </p>

                        {metrics ? (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 text-[11px] text-gray-600">
                            <span className="flex items-center gap-1">
                              <Timer className="w-3 h-3 text-gray-400" />
                              ใช้งาน {metrics.usageDays90d.toFixed(1)} วัน / 90 วัน
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              พักมาแล้ว {Math.floor(metrics.idleDays)} วัน
                            </span>
                            <span className="flex items-center gap-1">
                              <Repeat className="w-3 h-3 text-gray-400" />
                              ถูกยืม {metrics.borrowCount90d} ครั้ง
                            </span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            ไม่มีข้อมูลการใช้งาน
                          </p>
                        )}

                        {isRecommended && metrics && (
                          <p className="text-xs text-emerald-700 mt-1">
                            {buildReason(metrics)}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 sm:px-8 py-5 mt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={close}
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => proceed(selectedOption?.asset ?? clickedAsset)}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isError ? "ยืมเครื่องที่เลือกไว้" : "ยืมเครื่องนี้"}
          </button>
        </div>
      </div>
    </div>
  );
}
