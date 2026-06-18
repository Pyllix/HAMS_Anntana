// src/components/Header.tsx
import { useAuthStore } from "@/stores/authStore"
import { User } from "lucide-react"

interface HeaderProps {
  title: string
}

export default function Header({ title }: HeaderProps) {
  const { user } = useAuthStore()

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>

      <div className="flex items-center gap-4">
        {/* ข้อมูลโปรไฟล์ผู้ใช้ */}
        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <User size={16} className="text-blue-600" />
          </div>

          <span className="font-medium text-slate-700">
            {user?.name ?? "ผู้ใช้งาน"}
          </span>
        </div>
      </div>
    </header>
  )
}
