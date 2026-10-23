import { Box, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  authLogin,
  getLoginErrorMessage,
  getVerificationEmailErrorMessage,
  getVerificationEmailRetryDelay,
  isEmailVerificationRequired,
  sendVerificationEmail,
} from "../services/authService";
import { useAuthStore } from "../stores/authStore";
import { routeForPreAuthStep } from "../types/AuthFlow";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/loader/Spinner";
import ToastContainer from "../components/borrow-return/ToastContainer";
import { useToastStore } from "../stores/useToastStore";
import { establishClientSession } from "../services/clientAuthState";

export default function Login() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const requestPending = useRef(false);
  const isBusy = isLoading || isSendingVerification;

  const navigate = useNavigate();
  const enterPreAuth = useAuthStore((state) => state.enterPreAuth);
  const showToast = useToastStore((state) => state.showToast);

  useEffect(() => {
    if (!resendAvailableAt) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
      setResendSecondsLeft(seconds);
      if (seconds === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  function startResendCooldown(seconds: number) {
    setResendSecondsLeft(seconds);
    setResendAvailableAt(Date.now() + seconds * 1000);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    if (name === "email") {
      setVerificationEmail(null);
      setVerificationResult(null);
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (requestPending.current) return;
    requestPending.current = true;
    setIsLoading(true);
    setVerificationResult(null);
    try {
      const result = await authLogin(formData.email.trim(), formData.password);
      if (result.kind === "pre-auth") {
        enterPreAuth(result.step);
        navigate(routeForPreAuthStep(result.step), { replace: true });
        return;
      }

      establishClientSession(result);
      showToast("success", "เข้าสู่ระบบสำเร็จ");
      navigate("/", { replace: true });
    } catch (error) {
      if (isEmailVerificationRequired(error)) {
        setVerificationEmail(formData.email.trim());
      } else {
        setVerificationEmail(null);
        showToast("error", getLoginErrorMessage(error));
      }
    } finally {
      requestPending.current = false;
      setIsLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!verificationEmail || requestPending.current || Date.now() < resendAvailableAt) return;
    requestPending.current = true;
    setIsSendingVerification(true);
    setVerificationResult(null);
    try {
      const retryAfterSeconds = await sendVerificationEmail(verificationEmail);
      startResendCooldown(retryAfterSeconds);
      setVerificationResult({
        type: "success",
        message: "ส่งแล้ว โปรดตรวจอีเมลหรือสแปม",
      });
    } catch (error) {
      const retryDelay = getVerificationEmailRetryDelay(error);
      if (retryDelay > 0) startResendCooldown(retryDelay);
      setVerificationResult({ type: "error", message: getVerificationEmailErrorMessage(error) });
    } finally {
      requestPending.current = false;
      setIsSendingVerification(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-bg-app px-4 py-8 antialiased">
      <div className="relative overflow-hidden flex flex-col md:flex-row justify-between max-w-3xl w-full min-h-125 bg-bg-component rounded-3xl shadow-xl">
        <div className="relative overflow-hidden flex-1 min-w-0 flex flex-col gap-3 justify-center items-center bg-emerald-600 text-white p-6 md:p-8">
          <div className="absolute top-[-15%] left-[-5%] w-60 h-60 bg-emerald-900/40 rounded-full pointer-events-none"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-60 h-60 bg-emerald-500/40 rounded-full pointer-events-none"></div>
          <Box className="w-10 h-10" />
          <div className="space-y-3">
            <h1 className="text-2xl text-center font-bold tracking-tight">
              ระบบจัดการครุภัณฑ์
            </h1>
            <p className="text-sm text-center font-normal leading-relaxed">
              บริหารจัดการทรัพยากรและอุปกรณ์ <br />ขององค์กรได้อย่างมีประสิทธิภาพ
            </p>
          </div>
        </div>
        <div className="flex-1 min-w-0 p-6 md:p-8 flex flex-col gap-3 justify-center">
          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              ยินดีต้อนรับเข้าสู่ระบบ
            </h1>
            <p className="text-sm font-normal text-slate-400 leading-relaxed">
              กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบ
            </p>
          </div>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                ชื่อผู้ใช้
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="admin@company.com"
                  onChange={handleInputChange}
                  name="email"
                  value={formData.email}
                  autoComplete="username"
                  required
                  disabled={isBusy}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                รหัสผ่าน
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="****************"
                  onChange={handleInputChange}
                  name="password"
                  value={formData.password}
                  autoComplete="current-password"
                  required
                  disabled={isBusy}
                  className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" strokeWidth={1.5} />
                  ) : (
                    <Eye className="w-5 h-5" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
            <button
              disabled={isBusy}
              type="submit"
              className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Spinner className="w-5 h-5 text-white" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                "เข้าสู่ระบบ"
              )}
            </button>
          </form>
          <div className="mt-4 h-44 shrink-0">
            {verificationEmail && (
              <section
                aria-label="ยืนยันอีเมล"
                className="flex h-full flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
              >
                <div role="status">
                  <p className="font-semibold">กรุณายืนยันอีเมล</p>
                  <p className="mt-1 text-xs leading-5">ตรวจกล่องข้อความหรือสแปมก่อนขอใหม่</p>
                </div>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isBusy || resendSecondsLeft > 0}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400 bg-white px-3 py-2.5 font-semibold text-amber-950 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingVerification ? (
                    <><Spinner className="h-4 w-4" />กำลังส่งอีเมล...</>
                  ) : resendSecondsLeft > 0 ? (
                    `ส่งใหม่ใน ${Math.floor(resendSecondsLeft / 60)}:${String(resendSecondsLeft % 60).padStart(2, "0")}`
                  ) : (
                    "ส่งอีเมลยืนยันอีกครั้ง"
                  )}
                </button>
                <p
                  role={verificationResult?.type === "error" ? "alert" : "status"}
                  className={`min-h-10 text-xs leading-5 ${verificationResult?.type === "error" ? "text-rose-700" : "text-emerald-800"}`}
                >
                  {verificationResult?.message}
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
