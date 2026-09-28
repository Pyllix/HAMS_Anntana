import { FormEvent, useEffect, useState } from "react";
import { KeyRound, ShieldAlert, X } from "lucide-react";
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="admin-security-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="admin-security-title" className="text-xl font-bold text-slate-900">จัดการความปลอดภัยบัญชี</h2>
            <p className="mt-1 text-sm text-slate-500">{user.firstname} {user.lastname} · {user.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-6">
          {isOwnAccount ? (
            <p className="rounded-lg bg-indigo-50 p-4 text-sm text-indigo-900">บัญชีนี้เป็นบัญชีที่กำลังใช้งาน เปลี่ยนรหัสผ่านหรือ Authenticator ได้ที่เมนู “ความปลอดภัยบัญชี” ของตนเอง ส่วนการกู้ 2FA ต้องให้ ADMIN คนอื่นช่วย</p>
          ) : action === null ? (
            <>
              <p className="text-sm text-slate-600">รายการที่มีความเสี่ยงสูงต้องยืนยัน TOTP อีกครั้ง แม้ Browser นี้จะถูก Trusted</p>
              <button type="button" onClick={() => { setAction("password"); setError(""); }} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50"><KeyRound className="h-5 w-5 text-indigo-600" /><span><strong className="block text-slate-900">รีเซ็ตรหัสผ่าน</strong><span className="text-sm text-slate-500">เพิกถอน Session และ Trusted Browser ทั้งหมดของบัญชี</span></span></button>
              <button type="button" onClick={() => { setAction("two-factor"); setError(""); }} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-4 text-left hover:border-amber-300 hover:bg-amber-50"><ShieldAlert className="h-5 w-5 text-amber-600" /><span><strong className="block text-slate-900">รีเซ็ต 2FA</strong><span className="text-sm text-slate-500">ต้องตรวจตัวตนเจ้าของบัญชีนอกระบบและระบุเหตุผล</span></span></button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => { setAction(null); setNeedsStepUp(false); setError(""); }} className="text-sm font-semibold text-indigo-700 hover:underline">← เลือกรายการอื่น</button>
              <form onSubmit={needsStepUp ? submitStepUp : submitAction} className="space-y-4">
                <h3 className="font-semibold text-slate-900">{actionLabel}: {user.firstname} {user.lastname}</h3>
                {action === "password" ? (
                  <>
                    <label className="block text-sm font-medium text-slate-700">รหัสผ่านใหม่<input required minLength={8} maxLength={128} autoComplete="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                    <label className="block text-sm font-medium text-slate-700">ยืนยันรหัสผ่านใหม่<input required minLength={8} maxLength={128} autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                    <p className="text-sm text-slate-600">ผู้ใช้จะต้องเข้าสู่ระบบใหม่ Session และ Trusted Browser เดิมทั้งหมดจะถูกเพิกถอน</p>
                  </>
                ) : (
                  <>
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">ตรวจยืนยันตัวจริงของเจ้าของบัญชีนอก HAMS ก่อนรีเซ็ต เมื่อสำเร็จผู้ใช้ต้องตั้งค่า Authenticator ใหม่</p>
                    <label className="block text-sm font-medium text-slate-700">เหตุผลในการรีเซ็ต<textarea required minLength={10} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="ระบุเหตุผลโดยไม่ใส่รหัสผ่าน, TOTP หรือข้อมูลบัตรประชาชน" /></label>
                    <label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={identityVerified} onChange={(event) => setIdentityVerified(event.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" /><span>ยืนยันว่าตรวจสอบตัวตนเจ้าของบัญชีนอกระบบ HAMS แล้ว</span></label>
                  </>
                )}

                {stepUpExpiresAt && isAdminStepUpActive() && !needsStepUp ? (
                  <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">ยืนยัน TOTP แล้ว ใช้กับรายการ ADMIN ใน Session นี้ได้ถึง {new Date(stepUpExpiresAt).toLocaleTimeString("th-TH")}</p>
                ) : needsStepUp ? (
                  <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                    <p className="text-sm font-semibold text-indigo-900">ยืนยัน TOTP เพื่อเปิด Step-up 5 นาที</p>
                    <label className="block text-sm font-medium text-indigo-900">TOTP ปัจจุบัน<input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={stepUpCode} onChange={(event) => setStepUpCode(event.target.value)} className="mt-1.5 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2.5" /></label>
                  </div>
                ) : null}

                {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
                <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                  <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">ยกเลิก</button>
                  {needsStepUp ? (
                    <button disabled={busy || stepUpCode.length !== 6} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "กำลังตรวจสอบ..." : "ยืนยัน TOTP และทำรายการ"}</button>
                  ) : (
                    <button disabled={busy || (action === "password" ? newPassword.length < 8 || confirmPassword.length < 8 : reason.trim().length < 10 || !identityVerified)} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "กำลังทำรายการ..." : "ยืนยันรายการ"}</button>
                  )}
                </div>
              </form>
            </>
          )}

          {error && action === null && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        </div>
      </div>
    </div>
  );
}
