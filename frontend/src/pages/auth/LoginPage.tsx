import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"

export default function LoginPage() {
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()

  function handleLogin() {
    login({
      user: {
        id: "USR001",
        name: "ภญ. สมหญิง รักดี",
        email: "somying.r@hospital.com",
      },
      token: "mock-jwt-token-xyz123",
      role: "pharmacist",
    })
    navigate("/", { replace: true })
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">เข้าสู่ระบบ</h1>
        <p className="mb-6 text-slate-600">กดปุ่มด้านล่างเพื่อเข้าสู่ระบบตัวอย่าง</p>
        <button
          type="button"
          onClick={handleLogin}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-white transition hover:bg-slate-700"
        >
          ล็อกอิน
        </button>
      </div>
    </main>
  )
}
