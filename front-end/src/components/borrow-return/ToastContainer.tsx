import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useToastStore } from "../../stores/useToastStore";
import type { ToastItem, ToastType } from "../../stores/useToastStore";

const EXIT_DURATION = 250;

const TOAST_STYLES: Record<
  ToastType,
  { iconBg: string; iconColor: string; icon: typeof CheckCircle2; holdDuration: number }
> = {
  success: {
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    icon: CheckCircle2,
    holdDuration: 2200,
  },
  error: {
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    icon: XCircle,
    holdDuration: 3200,
  },
  warning: {
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    icon: AlertTriangle,
    holdDuration: 2200,
  },
};

function Toast({ toast }: { toast: ToastItem }) {
  const dismissToast = useToastStore((s) => s.dismissToast);
  const [isLeaving, setIsLeaving] = useState(false);
  const style = TOAST_STYLES[toast.type];
  const Icon = style.icon;

  useEffect(() => {
    const leaveTimer = setTimeout(() => setIsLeaving(true), style.holdDuration);
    return () => clearTimeout(leaveTimer);
  }, [style.holdDuration]);

  useEffect(() => {
    if (!isLeaving) return;
    const removeTimer = setTimeout(
      () => dismissToast(toast.id),
      EXIT_DURATION,
    );
    return () => clearTimeout(removeTimer);
  }, [isLeaving, toast.id, dismissToast]);

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 max-w-[min(90vw,22rem)] rounded-2xl bg-slate-900/90 backdrop-blur-sm px-5 py-3.5 shadow-2xl transition-all duration-250 ease-out ${
        isLeaving ? "opacity-0 scale-95 -translate-y-2" : "opacity-100 scale-100 animate-toast-in"
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${style.iconBg}`}
      >
        <Icon className={`h-4 w-4 ${style.iconColor}`} />
      </span>
      <p className="text-sm text-white leading-snug">{toast.message}</p>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-2.5 px-4 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
