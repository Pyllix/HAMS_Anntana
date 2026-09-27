import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentSession,
  getTwoFactorErrorMessage,

  verifyRecoveryCodeAtLogin,
  verifyTotpAtLogin,
} from "../services/authService";
import { establishClientSession } from "../services/clientAuthState";
import useSignOut from "../hooks/useSignOut";

export default function TwoFactorLogin() {
  const navigate = useNavigate();
  const { signOut, isSigningOut, signOutError } = useSignOut();
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [code, setCode] = useState("");
  const [trustBrowser, setTrustBrowser] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = useRecoveryCode ? code.trim().toUpperCase() : code.trim();
    if (useRecoveryCode ? normalizedCode.length !== 8 : !/^\d{6}$/.test(normalizedCode)) {
      setErrorMessage(useRecoveryCode
        ? "กรอก Recovery Code ให้ครบ 8 ตัวอักษร"
        : "กรอกรหัสจากแอป Authenticator ให้ครบ 6 หลัก");
      return;
    }

    setIsBusy(true);
    setErrorMessage("");
    try {
      if (useRecoveryCode) {
        await verifyRecoveryCodeAtLogin(normalizedCode, trustBrowser);
      } else {
        await verifyTotpAtLogin(normalizedCode, trustBrowser);
      }
      setCode("");
      const current = await getCurrentSession();
      if (!current) {
        setErrorMessage("ยืนยันรหัสแล้ว แต่ยังโหลดเซสชันไม่ได้ กรุณาโหลดหน้านี้ใหม่เพื่อดำเนินการต่อ");
        return;
      }
      establishClientSession(current);
      navigate("/", { replace: true });
    } catch (error) {
      setCode("");
      setErrorMessage(getTwoFactorErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  function changeVerificationMethod(nextUsesRecoveryCode: boolean) {
    setUseRecoveryCode(nextUsesRecoveryCode);
    setCode("");
    setErrorMessage("");
  }

  return (
    <main className="min-h-screen bg-bg-app px-4 py-10 text-slate-900">
      <section className="mx-auto w-full max-w-lg rounded-2xl bg-bg-component p-6 shadow-xl sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">ยืนยันตัวตน</p>
        <h1 className="mt-2 text-2xl font-bold">ยืนยัน Two-Factor Authentication</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          กรอกรหัสจากแอป Authenticator หรือใช้ Recovery Code ที่ยังไม่เคยใช้
        </p>

        {errorMessage && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">
            {errorMessage}
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={verify}>
          <label htmlFor="login-two-factor-code" className="block text-sm font-semibold text-slate-700">
            {useRecoveryCode ? "Recovery Code" : "รหัส Authenticator 6 หลัก"}
          </label>
          <input
            id="login-two-factor-code"
            type="text"
            inputMode={useRecoveryCode ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoCapitalize={useRecoveryCode ? "characters" : "off"}
            maxLength={useRecoveryCode ? 8 : 6}
            value={code}
            onChange={(event) => setCode(useRecoveryCode
              ? event.target.value.replace(/[^a-fA-F0-9]/g, "").slice(0, 8).toUpperCase()
              : event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-mono text-xl tracking-[0.35em] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200"
          />

          <button
            type="button"
            onClick={() => changeVerificationMethod(!useRecoveryCode)}
            className="text-sm font-semibold text-emerald-800 underline underline-offset-2"
          >
            {useRecoveryCode ? "ใช้รหัสจากแอป Authenticator" : "ใช้ Recovery Code แทน"}
          </button>

          <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={trustBrowser}
              onChange={(event) => setTrustBrowser(event.target.checked)}
              className="mt-1 h-4 w-4 accent-emerald-700"
            />
            <span>จำ browser นี้เป็นเวลา 14 วัน การจำ browser ไม่ได้ยืดอายุเซสชัน ซึ่งยังหมดตามเวลา idle และสูงสุด 12 ชั่วโมง</span>
          </label>

          <button
            type="submit"
            disabled={isBusy || isSigningOut}
            className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? "กำลังตรวจสอบ..." : "ยืนยันและเข้าสู่ระบบ"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void signOut()}
          disabled={isBusy || isSigningOut}
          className="mt-5 w-full rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
        >
          ใช้บัญชีอื่น
        </button>
        {signOutError && <p role="alert" className="mt-3 text-sm text-red-700">{signOutError}</p>}
      </section>
    </main>
  );
}
