import { FormEvent, useEffect, useState } from "react";
import { ChevronRight, KeyRound, ShieldAlert, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "../../types/TypeUser";
import { useAuthStore } from "../../stores/authStore";
import {
  adminResetPassword,
  adminResetTwoFactor,
  clearAdminStepUp,
  createAdminStepUp,
  getAdminStepUpExpiry,
  isAdminStepUpActive,
} from "../../services/accountSecurityService";

type SecurityAction = "password" | "two-factor" | null;

function responseCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { code?: string } } }).response?.data?.code;
}

function friendlyError(error: unknown): string {
  const data = (error as { response?: { data?: { code?: string; message?: string } } }).response?.data;
  if (data?.code === "STEP_UP_REQUIRED" || data?.code === "ADMIN_STEP_UP_REQUIRED") {
    return "การยืนยัน TOTP หมดอายุแล้ว กรุณายืนยันใหม่ก่อนทำรายการ";
  }
  if (data?.code === "LAST_ACTIVE_ENROLLED_ADMIN") {
    return "ดำเนินการไม่ได้ เพราะจะทำให้ไม่มี ADMIN ที่เปิดใช้ 2FA เหลืออยู่";
  }
  if (data?.code === "SELF_2FA_RESET_NOT_ALLOWED") {
    return "ไม่สามารถรีเซ็ต 2FA ของบัญชีที่กำลังใช้งานได้ ให้เจ้าหน้าที่ ADMIN คนอื่นช่วยดำเนินการ";
  }
  if (data?.message && typeof data.message === "string") return data.message;
  return "ทำรายการไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง";
}

export default function DialogAdminSecurityActions({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}) {
  const queryClient = useQueryClient();
  const actorUserId = useAuthStore((state) => state.user?.id);
  const [action, setAction] = useState<SecurityAction>(null);
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpExpiresAt, setStepUpExpiresAt] = useState<number | null>(null);
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reason, setReason] = useState("");
  const [identityVerified, setIdentityVerified] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setAction(null);
    setStepUpCode("");
    setStepUpExpiresAt(getAdminStepUpExpiry());
    setNeedsStepUp(false);
    setNewPassword("");
    setConfirmPassword("");
    setReason("");
    setIdentityVerified(false);
    setError("");
  }, [isOpen, user.id]);

  if (!isOpen) return null;

  const isOwnAccount = user.id === actorUserId;
  const actionLabel = action === "password" ? "รีเซ็ตรหัสผ่าน" : "รีเซ็ต 2FA";

  const performAction = async () => {
    if (!action) return;
    if (!isAdminStepUpActive()) {
      setStepUpExpiresAt(null);
      setNeedsStepUp(true);
      return;
    }

    setBusy(true);
    setError("");
    try {
      if (action === "password") {
        await adminResetPassword(user.id, newPassword);
      } else {
        await adminResetTwoFactor(user.id, reason.trim());
      }
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    } catch (cause) {
      const code = responseCode(cause);
      if (code === "STEP_UP_REQUIRED" || code === "ADMIN_STEP_UP_REQUIRED") {
        clearAdminStepUp();
        setStepUpExpiresAt(null);
        setNeedsStepUp(true);
      }
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  };

  const submitAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (action === "password" && newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่และช่องยืนยันไม่ตรงกัน");
      return;
    }
    if (action === "two-factor" && reason.trim().length < 10) {
      setError("กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร โดยไม่ใส่ข้อมูลลับหรือข้อมูลส่วนบุคคล");
      return;
    }
    if (action === "two-factor" && !identityVerified) {
      setError("ต้องยืนยันว่าตรวจสอบตัวตนเจ้าของบัญชีนอกระบบ HAMS แล้ว");
      return;
    }
    await performAction();
  };

  const submitStepUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const expiration = await createAdminStepUp(stepUpCode);
      setStepUpExpiresAt(Date.parse(expiration));
      setStepUpCode("");
      setNeedsStepUp(false);
      await performAction();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-3 text-left whitespace-normal backdrop-blur-sm sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="admin-security-title" className="flex max-h-[90dvh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-8">
          <div className="min-w-0 flex-1">
            <h2 id="admin-security-title" className="text-lg font-bold leading-snug text-slate-900 sm:text-xl">จัดการความปลอดภัยบัญชี</h2>
            <p className="mt-1 break-words text-sm leading-relaxed text-slate-500">{user.firstname} {user.lastname}</p>
            <p className="break-words text-xs leading-relaxed text-slate-400">{user.email}</p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} aria-label="ปิด" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"><X className="h-5 w-5 stroke-[2.5]" /></button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto p-5 sm:p-8">
          {isOwnAccount ? (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">บัญชีนี้เป็นบัญชีที่คุณกำลังใช้งาน เปลี่ยนรหัสผ่านหรือแอปยืนยันตัวตนได้ที่เมนู “ความปลอดภัยบัญชี” หากต้องรีเซ็ต 2FA ให้ผู้ดูแลระบบคนอื่นช่วยดำเนินการ</p>
          ) : action === null ? (
            <>
              <p className="text-sm leading-relaxed text-slate-500">เลือกสิ่งที่ต้องการรีเซ็ต โดยต้องยืนยันตัวตนก่อนทำรายการ</p>
              <div className="space-y-3">
                <button type="button" onClick={() => { setAction("password"); setError(""); }} className="group flex w-full min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"><KeyRound className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1 break-words">
                    <strong className="block text-sm font-semibold leading-6 text-slate-900">รีเซ็ตรหัสผ่าน</strong>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">ตั้งรหัสผ่านใหม่และให้ผู้ใช้ออกจากระบบทุกอุปกรณ์</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 self-center text-slate-400 group-hover:text-emerald-600" />
                </button>
                <button type="button" onClick={() => { setAction("two-factor"); setError(""); }} className="group flex w-full min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"><ShieldAlert className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1 break-words">
                    <strong className="block text-sm font-semibold leading-6 text-slate-900">รีเซ็ต 2FA</strong>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">ให้ผู้ใช้ตั้งค่าการยืนยันตัวตนสองขั้นตอนใหม่ หลังตรวจสอบเจ้าของบัญชีแล้ว</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 self-center text-slate-400 group-hover:text-emerald-600" />
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => { setAction(null); setNeedsStepUp(false); setError(""); }} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline disabled:opacity-50">← เลือกรายการอื่น</button>
              <form onSubmit={needsStepUp ? submitStepUp : submitAction} className="space-y-4">
                <h3 className="break-words font-semibold leading-relaxed text-slate-900">{actionLabel}: {user.firstname} {user.lastname}</h3>
                {action === "password" ? (
                  <>
                    <label className="block text-sm font-medium text-slate-700">รหัสผ่านใหม่<input required minLength={8} maxLength={128} autoComplete="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
                    <label className="block text-sm font-medium text-slate-700">ยืนยันรหัสผ่านใหม่<input required minLength={8} maxLength={128} autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
                    <p className="text-xs leading-relaxed text-slate-500">เมื่อรีเซ็ตสำเร็จ ผู้ใช้ต้องเข้าสู่ระบบและยืนยันตัวตนใหม่ทุกอุปกรณ์</p>
                  </>
                ) : (
                  <>
                    <p className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">ตรวจสอบตัวตนเจ้าของบัญชีก่อนรีเซ็ต เมื่อสำเร็จ ผู้ใช้ต้องตั้งค่าแอปยืนยันตัวตนใหม่</p>
                    <label className="block text-sm font-medium text-slate-700">เหตุผลในการรีเซ็ต<textarea required minLength={10} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="ระบุเหตุผล โดยไม่ใส่รหัสผ่าน รหัสยืนยัน หรือเลขบัตรประชาชน" /></label>
                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700"><input type="checkbox" checked={identityVerified} onChange={(event) => setIdentityVerified(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" /><span className="min-w-0 break-words leading-relaxed">ตรวจสอบตัวตนเจ้าของบัญชีแล้ว เช่น พบเจ้าตัวหรือยืนยันผ่านช่องทางของโรงพยาบาล</span></label>
                  </>
                )}

                {stepUpExpiresAt && isAdminStepUpActive() && !needsStepUp ? (
                  <p className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">ยืนยันตัวตนแล้ว ทำรายการต่อได้ถึง {new Date(stepUpExpiresAt).toLocaleTimeString("th-TH")}</p>
                ) : needsStepUp ? (
                  <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900">ยืนยันตัวตนก่อนทำรายการ</p>
                    <p className="text-xs leading-relaxed text-emerald-800">ใช้รหัส 6 หลักของคุณจากแอปยืนยันตัวตน เมื่อยืนยันแล้วจะทำรายการต่อได้ 5 นาที</p>
                    <label className="block text-sm font-medium text-emerald-900">รหัสยืนยัน<input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={stepUpCode} onChange={(event) => setStepUpCode(event.target.value)} className="mt-1.5 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
                  </div>
                ) : null}

                {error && <p role="alert" className="break-words rounded-xl bg-rose-50 p-3 text-sm leading-relaxed text-rose-800">{error}</p>}
                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                  <button type="button" disabled={busy} onClick={onClose} className="w-full rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">ยกเลิก</button>
                  {needsStepUp ? (
                    <button disabled={busy || stepUpCode.length !== 6} className="w-full rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{busy ? "กำลังตรวจสอบ..." : "ยืนยันและทำรายการ"}</button>
                  ) : (
                    <button disabled={busy || (action === "password" ? newPassword.length < 8 || confirmPassword.length < 8 : reason.trim().length < 10 || !identityVerified)} className="w-full rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{busy ? "กำลังทำรายการ..." : "ยืนยันรายการ"}</button>
                  )}
                </div>
              </form>
            </>
          )}

          {error && action === null && <p role="alert" className="break-words rounded-xl bg-rose-50 p-3 text-sm leading-relaxed text-rose-800">{error}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
