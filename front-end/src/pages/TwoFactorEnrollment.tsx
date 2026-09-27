import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  acknowledgeRecoveryCodes,
  enableTwoFactor,
  getCurrentSession,
  getTwoFactorErrorMessage,

  verifyTwoFactorSetup,
} from "../services/authService";
import { establishClientSession } from "../services/clientAuthState";

import Spinner from "../components/loader/Spinner";
import useSignOut from "../hooks/useSignOut";

function secretFromTotpUri(totpUri: string): string {
  const parsed = new URL(totpUri);
  const secret = parsed.searchParams.get("secret");
  if (parsed.protocol !== "otpauth:" || !secret) {
    throw new Error("The authenticator URI did not include a secret");
  }
  return secret;
}

export default function TwoFactorEnrollment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, isSigningOut, signOutError } = useSignOut();
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [savedCodes, setSavedCodes] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [codesUnavailable, setCodesUnavailable] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const lastLocationKey = useRef(location.key);

  useEffect(() => {
    if (lastLocationKey.current === location.key) return;
    lastLocationKey.current = location.key;
    setPassword("");
    setTotpUri("");
    setSecret("");
    setCode("");
    setBackupCodes(null);
    setSavedCodes(false);
    setSetupComplete(false);
    setCodesUnavailable(false);
    setCopyMessage("");
    setErrorMessage("");
  }, [location.key]);

  async function beginEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setErrorMessage("");
    try {
      const uri = await enableTwoFactor(password);
      const secretValue = secretFromTotpUri(uri);
      setTotpUri(uri);
      setSecret(secretValue);
      setPassword("");
    } catch (error) {
      setErrorMessage(getTwoFactorErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function verifySetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage("กรอกรหัสจากแอป Authenticator ให้ครบ 6 หลัก");
      return;
    }

    setIsBusy(true);
    setErrorMessage("");
    try {
      const codes = await verifyTwoFactorSetup(code);
      setTotpUri("");
      setSecret("");
      setCode("");
      if (!Array.isArray(codes) || codes.length !== 10) {
        setCodesUnavailable(true);
        return;
      }
      setBackupCodes(codes);
    } catch (error) {
      setErrorMessage(getTwoFactorErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function continueAfterSetup() {
    setIsBusy(true);
    setErrorMessage("");
    try {
      const current = await getCurrentSession();
      if (!current) {
        setErrorMessage("ยืนยันการตั้งค่าแล้ว แต่ยังโหลดเซสชันไม่ได้ กรุณาลองต่ออีกครั้งหรือเข้าสู่ระบบใหม่");
        return;
      }
      establishClientSession(current);
      navigate("/", { replace: true });
    } catch {
      setErrorMessage("ตั้งค่า 2FA เสร็จแล้ว แต่เชื่อมต่อเพื่อเข้าแอปไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setIsBusy(false);
    }
  }

  async function acknowledgeAndContinue() {
    if (!savedCodes) return;
    setIsBusy(true);
    setErrorMessage("");
    let acknowledged = false;
    try {
      await acknowledgeRecoveryCodes();
      acknowledged = true;
      setBackupCodes(null);
      setSetupComplete(true);
      await continueAfterSetup();
    } catch (error) {
      if (acknowledged) {
        setErrorMessage("ยืนยันการเก็บ Recovery Codes แล้ว จึงไม่สามารถแสดงรหัสซ้ำได้ กรุณาลองเข้าแอปอีกครั้ง");
      } else {
        setErrorMessage(getTwoFactorErrorMessage(error));
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function copyBackupCodes() {
    if (!backupCodes) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopyMessage("คัดลอกรหัสแล้ว เก็บไว้ในที่ปลอดภัย");
    } catch {
      setCopyMessage("คัดลอกอัตโนมัติไม่ได้ กรุณาบันทึกรหัสจากรายการนี้");
    }
  }

  return (
    <main className="min-h-screen bg-bg-app px-4 py-10 text-slate-900">
      <section className="mx-auto w-full max-w-2xl rounded-2xl bg-bg-component p-6 shadow-xl sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">ตั้งค่าความปลอดภัย</p>
        <h1 className="mt-2 text-2xl font-bold">ตั้งค่า Two-Factor Authentication</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          บัญชีนี้ต้องตั้งค่า 2FA ก่อนเข้าใช้งาน กรุณาใช้แอป Authenticator สแกน QR หรือกรอก Secret ด้วยตนเอง
        </p>
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          Secret และ Recovery Codes แสดงให้เห็นชั่วคราวเท่านั้น หากออกจากหน้านี้ก่อนยืนยันการเก็บรหัส จะเปิดดูรหัสชุดเดิมซ้ำไม่ได้และต้องให้ผู้ดูแลระบบรีเซ็ต 2FA
        </p>

        {errorMessage && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </p>
        )}

        {setupComplete ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              เปิดใช้งาน 2FA แล้ว และ Recovery Codes ไม่สามารถแสดงซ้ำได้
            </p>
            <button
              type="button"
              onClick={() => void continueAfterSetup()}
              disabled={isBusy || isSigningOut}
              className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {isBusy ? "กำลังเข้าแอป..." : "ลองเข้าแอปอีกครั้ง"}
            </button>
          </div>
        ) : codesUnavailable ? (
          <div className="mt-6 rounded-lg bg-red-50 p-4 text-sm leading-6 text-red-800" role="alert">
            เซิร์ฟเวอร์ไม่สามารถแสดง Recovery Codes ได้อย่างปลอดภัย กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ต 2FA ก่อนเข้าสู่ระบบ
          </div>
        ) : backupCodes ? (
          <section className="mt-6 space-y-4" aria-labelledby="recovery-codes-title">
            <div>
              <h2 id="recovery-codes-title" className="text-lg font-semibold">Recovery Codes</h2>
              <p className="mt-1 text-sm text-slate-600">บันทึกรหัสทั้ง 10 รหัสไว้ในที่ปลอดภัย แต่ละรหัสใช้ได้ครั้งเดียวและจะไม่แสดงอีก</p>
            </div>
            <ol className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm sm:grid-cols-2">
              {backupCodes.map((backupCode, index) => (
                <li key={`${index}-${backupCode}`} className="rounded bg-slate-50 px-3 py-2">
                  {backupCode}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => void copyBackupCodes()}
              className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              คัดลอก Recovery Codes
            </button>
            {copyMessage && <p role="status" className="text-sm text-slate-600">{copyMessage}</p>}
            <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm leading-6">
              <input
                type="checkbox"
                checked={savedCodes}
                onChange={(event) => setSavedCodes(event.target.checked)}
                className="mt-1 h-4 w-4 accent-emerald-700"
              />
              <span>ฉันบันทึก Recovery Codes ไว้แล้วและเข้าใจว่าเปิดดูซ้ำไม่ได้</span>
            </label>
            <button
              type="button"
              onClick={() => void acknowledgeAndContinue()}
              disabled={!savedCodes || isBusy}
              className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? "กำลังยืนยัน..." : "ยืนยันและเข้าใช้งาน"}
            </button>
          </section>
        ) : !totpUri ? (
          <form className="mt-6 space-y-4" onSubmit={beginEnrollment}>
            <label htmlFor="enrollment-password" className="block text-sm font-semibold text-slate-700">
              ยืนยันรหัสผ่านปัจจุบัน
            </label>
            <input
              id="enrollment-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200"
            />
            <button
              type="submit"
              disabled={isBusy || isSigningOut}
              className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {isBusy ? <Spinner className="mx-auto h-5 w-5" /> : "สร้าง QR สำหรับ Authenticator"}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
              <QRCodeSVG value={totpUri} size={220} level="M" includeMargin aria-label="QR สำหรับตั้งค่า Authenticator" />
              <div className="w-full">
                <p className="text-sm font-semibold">Secret สำหรับกรอกด้วยตนเอง</p>
                <code className="mt-2 block break-all rounded-lg bg-slate-100 p-3 font-mono text-sm" aria-label="Authenticator secret">
                  {secret}
                </code>
              </div>
            </div>
            <form className="space-y-4" onSubmit={verifySetup}>
              <label htmlFor="setup-totp-code" className="block text-sm font-semibold text-slate-700">
                รหัส 6 หลักจากแอป Authenticator
              </label>
              <input
                id="setup-totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-mono text-xl tracking-[0.35em] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200"
              />
              <button
                type="submit"
                disabled={isBusy || isSigningOut}
                className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {isBusy ? "กำลังตรวจสอบ..." : "ยืนยัน Authenticator"}
              </button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={() => void signOut()}
          disabled={isBusy || isSigningOut}
          className="mt-6 w-full rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
        >
          ใช้บัญชีอื่น
        </button>
        {signOutError && <p role="alert" className="mt-3 text-sm text-red-700">{signOutError}</p>}
      </section>
    </main>
  );
}
