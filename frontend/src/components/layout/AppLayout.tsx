import { useAuthStore } from "@/stores/authStore"
import { Outlet, useLocation } from "react-router-dom"
import Header from "./Header"
import Sidebar from "./Sidebar"

const pageTitles: Record<string, string> = {
  "/": "จัดการการยืม-คืนครุภัณฑ์",
  "/inventory": "คลังครุภัณฑ์",
  "/requests": "จัดการสต็อกอะไหล่",
  "/settings": "ตั้งค่าระบบ",
}

export default function AppLayout() {
  const { role } = useAuthStore()
  const location = useLocation()

  const title = pageTitles[location.pathname] ?? "Hospital ERP"

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ด้านซ้าย */}
      <Sidebar userRole={role} />
      {/* ด้านขวา */}
      <div className="flex flex-1 flex-col">
        <Header title={title} />
        {/* ตรงนี้คือพื้นที่สำหรับแสดงเนื้อหาของแต่ละหน้า */}
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
