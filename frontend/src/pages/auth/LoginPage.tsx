import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { Mail, Lock, Eye, EyeOff, Package } from "lucide-react"

const ROLES = [
  "admin",
  "inventory_officer",
  "user",
  "technician",
  "manager",
] as const
type Role = (typeof ROLES)[number]

export default function LoginPage() {
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [selectedRole, setSelectedRole] = useState<Role>("admin")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    login({
      user: {
        id: "USR001",
        name: "ภญ. สมหญิง รักดี",
        email: "somying.r@hospital.com",
      },
      token: "mock-jwt-token-xyz123",
      role: selectedRole,
    })
    navigate("/", { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4 py-8 sm:p-4">
      {/* Custom Animations */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-18px) translateX(8px); }
        }
        @keyframes floatSlowReverse {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(14px) translateX(-10px); }
        }
        @keyframes softPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }

        .animate-card { animation: fadeSlideUp 0.7s ease-out forwards; }
        .animate-float-1 { animation: floatSlow 9s ease-in-out infinite; }
        .animate-float-2 { animation: floatSlowReverse 11s ease-in-out infinite; }
        .animate-float-3 { animation: floatSlow 13s ease-in-out infinite; }
        .animate-logo { animation: softPulse 4s ease-in-out infinite; }
      `}</style>

      {/* background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#059669]/20 to-transparent blur-3xl" />
        <div className="absolute top-1/4 -left-20 h-72 w-72 rounded-full bg-[#059669]/10 blur-3xl" />
        <div className="absolute top-1/3 left-10 h-40 w-56 rounded-[40%] bg-[#10B981]/10 blur-2xl" />
        <div className="absolute top-20 -right-16 h-64 w-64 rounded-full bg-[#047857]/12 blur-3xl" />
        <div className="absolute right-20 bottom-32 h-48 w-48 rounded-full bg-[#059669]/12 blur-2xl" />
      </div>

      <div className="relative z-10 flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 shadow-slate-200/60 ring-slate-100 md:flex-row">
        {/* Left */}
        <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#059669] to-[#047857] px-16 py-16 md:flex">
          <svg
            className="absolute bottom-0 left-0 w-full text-white/15"
            viewBox="0 0 1440 320"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <path
              d="M0 224C240 160 480 96 720 128C960 160 1200 256 1440 224V320H0V224Z"
              fill="currentColor"
            />
          </svg>
          <svg
            className="absolute bottom-0 left-0 w-full text-white/15"
            viewBox="0 0 1440 320"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <path
              d="M0 256C180 200 360 160 540 176C720 192 900 256 1080 240C1260 224 1350 192 1440 208V320H0V256Z"
              fill="currentColor"
            />
          </svg>
          <div className="absolute top-1/3 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-2xl" />

          {/* Logo */}
          <div className="animate-logo relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white/80 bg-white/10 backdrop-blur-sm">
            <Package className="h-9 w-9 text-white" strokeWidth={1.5} />
          </div>

          <h1 className="relative z-10 mt-8 text-center text-2xl leading-snug font-bold text-white lg:text-[30px]">
            ระบบบริหารจัดการครุภัณฑ์
          </h1>
          <p className="relative z-10 mt-4 text-center text-sm leading-relaxed text-[#D1FAE5] lg:text-[16px]">
            บริหารจัดการทรัพยากรและอุปกรณ์
            <br />
            ขององค์กรได้อย่างมีประสิทธิภาพ
          </p>
        </div>

        {/* Right */}
        <div className="flex w-full flex-col justify-center px-8 py-12 sm:px-12 md:w-1/2 md:px-16">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            ยินดีต้อนรับเข้าสู่ระบบ
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบ
          </p>

          <form
            onSubmit={handleLogin}
            className="mt-8 flex flex-col gap-5 sm:mt-10 sm:gap-6"
          >
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                อีเมล
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pr-4 pl-11 text-base text-slate-900 transition outline-none focus:border-[#059669] focus:bg-white focus:ring-4 focus:ring-[#059669]/10"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                รหัสผ่าน
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pr-11 pl-11 text-base text-slate-900 transition outline-none focus:border-[#059669] focus:bg-white focus:ring-4 focus:ring-[#059669]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#059669] focus:ring-[#059669]"
                />
                จดจำการเข้าสู่ระบบ
              </label>
              <button
                type="button"
                className="font-semibold text-[#059669] transition hover:text-[#047857] hover:underline"
              >
                ลืมรหัสผ่าน
              </button>
            </div>

            <div>
              <label
                htmlFor="role"
                className="mb-1.5 block text-xs font-medium text-slate-400"
              >
                Role (สำหรับทดสอบ)
              </label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as Role)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 transition outline-none focus:border-[#059669] focus:ring-4 focus:ring-[#059669]/10"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-[#059669] py-3.5 text-base font-bold text-white shadow-lg shadow-[#059669]/25 transition hover:bg-[#047857] hover:shadow-xl hover:shadow-[#059669]/30 active:scale-[0.98]"
            >
              เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
