import { useRef } from "react";
import { ImagePlus, LoaderCircle, UserRound } from "lucide-react";
import {
  IMAGE_SOURCE_ACCEPT,
  IMAGE_SOURCE_FORMAT_LABEL,
  IMAGE_SOURCE_MAX_BYTES,
} from "../../services/imageUploadService";
import type { ImageSelectionState } from "../../hooks/useImageUploadSelection";

export interface ImageUploadFieldProps {
  label: string;
  state: ImageSelectionState;
  currentPreviewUrl?: string | null;
  currentStatus?: "idle" | "loading" | "missing" | "error";
  currentError?: string;
  onSelectFile: (file: File) => void;
  onCancelSelection: () => void;
  cancelLabel?: string;
  disabled?: boolean;
  compact?: boolean;
}

export default function ImageUploadField({
  label,
  state,
  currentPreviewUrl,
  currentStatus = "idle",
  currentError,
  onSelectFile,
  onCancelSelection,
  cancelLabel = "ยกเลิกรูปใหม่และคงรูปเดิม",
  disabled = false,
  compact = false,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = state.status === "ready"
    ? state.previewUrl
    : currentPreviewUrl;
  const isWorking = state.status === "uploading" || state.status === "verifying";
  const hasSelection = state.status !== "idle";
  const boxClass = compact ? "h-40" : "h-52";

  const selectionMessage = state.status === "uploading"
    ? "กำลังส่งไฟล์ไปยังพื้นที่จัดเก็บโดยตรง…"
    : state.status === "verifying"
      ? "กำลังตรวจสอบและเตรียมรูปตัวอย่าง…"
      : state.status === "ready"
        ? "ตรวจสอบแล้ว รูปจะเปลี่ยนเมื่อกดบันทึก"
        : "";

  return (
    <section className="space-y-2" aria-label={label}>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <label className={`relative flex ${boxClass} cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-emerald-400 hover:bg-emerald-50/30 ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={state.status === "ready" ? "รูปใหม่ที่ตรวจสอบแล้ว" : label}
            className="pointer-events-none h-full w-full object-contain p-2"
          />
        ) : currentStatus === "loading" || isWorking ? (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <LoaderCircle className="h-7 w-7 animate-spin text-emerald-600" />
            <span className="text-xs">{state.status === "uploading" ? "กำลังอัปโหลด…" : "กำลังโหลดรูป…"}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-slate-500">
            {label.toLowerCase().includes("พนักงาน") ? (
              <UserRound className="h-8 w-8 text-slate-400" />
            ) : (
              <ImagePlus className="h-8 w-8 text-slate-400" />
            )}
            <span className="text-xs">{currentStatus === "missing" ? "ยังไม่มีรูป" : "เลือกรูปเพื่ออัปโหลด"}</span>
            <span className="text-[11px] leading-relaxed text-slate-400">
              {IMAGE_SOURCE_FORMAT_LABEL} · ไม่เกิน {IMAGE_SOURCE_MAX_BYTES / 1_000_000} MB
            </span>
          </div>
        )}
        {isWorking && previewUrl && (
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-white/90 py-1.5 text-xs text-emerald-700">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {state.status === "uploading" ? "กำลังอัปโหลดรูปใหม่…" : "กำลังตรวจสอบรูปใหม่…"}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_SOURCE_ACCEPT}
          disabled={disabled}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) onSelectFile(file);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-label={`เลือกรูปสำหรับ ${label}`}
        />
      </label>
      {state.fileName && (
        <p className="truncate text-xs text-slate-500" title={state.fileName}>
          {state.fileName}
        </p>
      )}
      {selectionMessage && (
        <p role="status" className="text-xs text-emerald-700">{selectionMessage}</p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-xs text-rose-700">{state.error}</p>
      )}
      {currentStatus === "error" && currentError && (
        <p role="alert" className="text-xs text-rose-700">{currentError}</p>
      )}
      {hasSelection && (
        <button
          type="button"
          onClick={onCancelSelection}
          disabled={disabled}
          className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      )}
    </section>
  );
}
