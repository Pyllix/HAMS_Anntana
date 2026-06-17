// src/components/Header.tsx
import { useAuthStore } from "@/stores/authStore"
import { Bell, User } from "lucide-react"
import { useNavigate } from "react-router-dom"

// กำหนด Props Interface สำหรับ Component นี้
interface HeaderProps {
  title: string
}

export default function Header({ title }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout() // เคลียร์ข้อมูลใน Zustand Store และ LocalStorage
    navigate('/login', { replace: true }) // 3. ดีดผู้ใช้งานกลับไปหน้า Login ทันที
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* ส่วนแสดงหัวข้อหน้าเพจปัจจุบันแบบ Dynamic */}
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>

      <div className="flex items-center gap-4">
        {/* ปุ่มแจ้งเตือน */}
        <button className="relative text-slate-500 hover:text-slate-700">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            3
          </span>
        </button>

        {/* ข้อมูลโปรไฟล์ผู้ใช้ */}
        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <User size={16} className="text-blue-600" />
          </div>
          {/* ข้อมูลจะเชื่อมกับ Zustand เสมอ ถ้าชื่อไม่มีจะใช้ค่า Fallback ตามที่คุณทำไว้ */}
          <span className="font-medium text-slate-700">
            {user?.name ?? "ผู้ใช้งาน"}
          </span>
        </div>

        {/* ปุ่ม Logout */}
        <button
          onClick={handleLogout}
          className="text-sm text-slate-500 transition-colors hover:text-red-600"
        >
          ออกจากระบบ
        </button>
      </div>
    </header>
  )
}
