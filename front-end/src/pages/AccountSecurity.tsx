import { FormEvent, useEffect, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  changeOwnPassword,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
  startAuthenticatorReplacement,
  verifyAuthenticatorReplacement,
  type TwoFactorStatus,
} from "../services/accountSecurityService";
import { getTwoFactorErrorMessage } from "../services/authService";

function errorMessage(error: unknown): string {
  const value = error as {
    response?: { data?: { code?: string; message?: string } };
  };
  const code = value.response?.data?.code;
  const message = value.response?.data?.message;
  if (code === "STEP_UP_REQUIRED") {
    return "การยืนยันหมดอายุแล้ว กรุณายืนยัน TOTP ใหม่";
  }
  if (code === "LAST_ACTIVE_ENROLLED_ADMIN") {
    return "ไม่สามารถดำเนินการได้ เพราะจะทำให้ไม่มีผู้ดูแลระบบที่เปิดใช้ 2FA เหลืออยู่";
  }
  return message ?? getTwoFactorErrorMessage(error);
}

function secretFromTotpUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  maxLength,
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: "text" | "numeric";
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

export default function AccountSecurity() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [currentTotp, setCurrentTotp] = useState("");
  const [replacementUri, setReplacementUri] = useState("");
  const [replacementCode, setReplacementCode] = useState("");

  const [recoveryTotp, setRecoveryTotp] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let active = true;
    void getTwoFactorStatus()
      .then((result) => {
        if (active) setStatus(result);
      })
      .catch(() => {
        if (active) setStatusError("โหลดสถานะ 2FA ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const beginReplacement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const uri = await startAuthenticatorReplacement(currentPassword, currentTotp);
      setReplacementUri(uri);
      setCurrentPassword("");
      setCurrentTotp("");
      setNotice("สแกน QR ด้วย Authenticator ตัวใหม่ แล้วกรอกรหัสจากแอปเพื่อยืนยัน");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const confirmReplacement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await verifyAuthenticatorReplacement(replacementCode);
      setReplacementUri("");
      setReplacementCode("");
      setNotice("เปลี่ยน Authenticator เรียบร้อยแล้ว");
      setStatus((previous) => previous ? { ...previous, enrolled: true } : previous);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerateCodes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const codes = await regenerateRecoveryCodes(recoveryTotp);
      setRecoveryCodes(codes);
      setRecoveryTotp("");
      setNotice("Recovery Codes ชุดเดิมใช้ไม่ได้แล้ว กรุณาบันทึกชุดใหม่นี้ก่อนปิดหน้าจอ");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่และช่องยืนยันไม่ตรงกัน");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setError("รหัสผ่านใหม่ต้องมีความยาว 8 ถึง 128 ตัวอักษร");
      return;
    }

    setBusy(true);
    try {
      await changeOwnPassword(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("เปลี่ยนรหัสผ่านแล้ว Session บนอุปกรณ์นี้ยังใช้งานต่อได้ ส่วน Session อื่นและ Trusted Browser ถูกเพิกถอนแล้ว");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const recoveryCodesVisible = recoveryCodes !== null;
  const replacementSecret = replacementUri ? secretFromTotpUri(replacementUri) : "";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <h2 className="text-xl font-bold text-slate-900">ความปลอดภัยบัญชี</h2>
            <p className="mt-1 text-sm text-slate-600">
              จัดการ Authenticator, Recovery Codes และรหัสผ่านของบัญชีที่กำลังใช้งาน
            </p>
            {loadingStatus ? (
              <p className="mt-3 text-sm text-slate-500">กำลังตรวจสอบสถานะ 2FA...</p>
            ) : statusError ? (
              <p role="alert" className="mt-3 text-sm text-rose-700">{statusError}</p>
            ) : (
              <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
                {status?.enrolled ? "2FA เปิดใช้งานอยู่" : "ยังไม่ได้ตั้งค่า 2FA"}
              </p>
            )}
            {status?.required && (
              <p className="mt-2 text-sm text-emerald-800">
                Role นี้ต้องใช้ 2FA เพื่อเข้าใช้งาน และไม่มีตัวเลือกปิด 2FA
              </p>
            )}
          </div>
        </div>
      </div>

      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {error || notice}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-slate-900">เปลี่ยน Authenticator</h3>
        </div>
        {!status?.enrolled || loadingStatus ? (
          <p className="text-sm text-slate-600">ต้องตั้งค่า 2FA ให้เสร็จก่อนจึงเปลี่ยน Authenticator ได้</p>
        ) : replacementUri ? (
          <form onSubmit={confirmReplacement} className="space-y-4">
            <p className="text-sm text-slate-600">สแกน QR ด้วยแอป Authenticator ใหม่ Secret นี้จะแสดงเฉพาะระหว่างการตั้งค่านี้</p>
            <div className="flex flex-col items-center gap-3 rounded-lg bg-slate-50 p-4">
              <QRCodeSVG value={replacementUri} size={192} level="M" />
              <p className="break-all text-center font-mono text-sm text-slate-800">{replacementSecret || "เปิด QR ในแอป Authenticator"}</p>
            </div>
            <TextField label="รหัส 6 หลักจาก Authenticator ใหม่" value={replacementCode} onChange={setReplacementCode} inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
            <div className="flex flex-wrap gap-3">
              <button disabled={busy || replacementCode.length !== 6} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">{busy ? "กำลังยืนยัน..." : "ยืนยัน Authenticator ใหม่"}</button>
              <button type="button" disabled={busy} onClick={() => { setReplacementUri(""); setReplacementCode(""); setNotice(""); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">ยกเลิกและซ่อน Secret</button>
            </div>
          </form>
        ) : (
          <form onSubmit={beginReplacement} className="space-y-4">
            <p className="text-sm text-slate-600">ต้องยืนยันรหัสผ่านและ TOTP ปัจจุบันก่อน ระบบจะใช้ Authenticator ใหม่หลังยืนยันรหัสจากแอปใหม่แล้วเท่านั้น</p>
            <TextField label="รหัสผ่านปัจจุบัน" value={currentPassword} onChange={setCurrentPassword} type="password" autoComplete="current-password" />
            <TextField label="TOTP ปัจจุบัน" value={currentTotp} onChange={setCurrentTotp} inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
            <button disabled={busy || currentPassword.length === 0 || currentTotp.length !== 6} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">{busy ? "กำลังตรวจสอบ..." : "เริ่มเปลี่ยน Authenticator"}</button>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900">ออก Recovery Codes ชุดใหม่</h3>
        {!status?.enrolled || loadingStatus ? (
          <p className="mt-2 text-sm text-slate-600">ต้องตั้งค่า 2FA ให้เสร็จก่อนจึงออก Recovery Codes ได้</p>
        ) : recoveryCodesVisible ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-amber-800">Recovery Codes ชุดเดิมถูกยกเลิกแล้ว บันทึกรหัสชุดใหม่นี้ไว้ในที่ปลอดภัย รหัสจะแสดงเฉพาะครั้งนี้</p>
            <ul className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-4 font-mono text-sm text-slate-900 sm:grid-cols-5">
              {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
            </ul>
            <button type="button" onClick={() => { setRecoveryCodes(null); setNotice("ซ่อน Recovery Codes แล้ว หากต้องการชุดใหม่อีกครั้งต้องยืนยัน TOTP ใหม่"); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">บันทึกแล้ว ซ่อนรหัส</button>
          </div>
        ) : (
          <form onSubmit={handleRegenerateCodes} className="mt-3 space-y-4">
            <p className="text-sm text-slate-600">ต้องยืนยัน TOTP ปัจจุบันทุกครั้ง แม้ Browser นี้จะถูกเชื่อถือสำหรับการ Login</p>
            <TextField label="TOTP ปัจจุบัน" value={recoveryTotp} onChange={setRecoveryTotp} inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
            <button disabled={busy || recoveryTotp.length !== 6} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">{busy ? "กำลังออก Recovery Codes..." : "ยืนยันและออกชุดใหม่"}</button>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900">เปลี่ยนรหัสผ่าน</h3>
        <p className="mt-1 text-sm text-slate-600">Session ปัจจุบันจะใช้งานต่อได้ ระบบจะออกจากระบบบนอุปกรณ์อื่นและเพิกถอน Trusted Browser ทุกเครื่อง</p>
        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <TextField label="รหัสผ่านเดิม" value={oldPassword} onChange={setOldPassword} type="password" autoComplete="current-password" />
          <TextField label="รหัสผ่านใหม่" value={newPassword} onChange={setNewPassword} type="password" autoComplete="new-password" />
          <TextField label="ยืนยันรหัสผ่านใหม่" value={confirmPassword} onChange={setConfirmPassword} type="password" autoComplete="new-password" />
          <button disabled={busy || !oldPassword || newPassword.length < 8 || confirmPassword.length < 8} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">{busy ? "กำลังเปลี่ยนรหัสผ่าน..." : "เปลี่ยนรหัสผ่าน"}</button>
        </form>
      </section>
    </div>
  );
}
