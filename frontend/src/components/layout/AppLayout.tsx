// src/layouts/AppLayout.tsx
import { useAuthStore } from "@/stores/authStore"
import { Outlet, useLocation } from "react-router-dom"
import Header from "./Header"
import Sidebar from "./Sidebar"

// 1. กำหนด Type ให้กับหน้าต่างๆ เพื่อทำดัชนี (Index Signature)
// ช่วยให้เวลาดึงค่าจาก string ทั่วไปใน location.pathname แล้ว TS จะไม่ฟ้องแดง
const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/inventory": "คลังครุภัณฑ์",
  "/requests": "รายการเบิกครุภัณฑ์",
  "/settings": "ตั้งค่าระบบ",
}

export default function AppLayout() {
  const { role } = useAuthStore()
  const location = useLocation()

  // ดึงหัวข้อเพจปัจจุบันออกมาแสดงผล ถ้าไม่มีในรายการจะดึงค่า Fallback เป็น 'Hospital ERP'
  const title = pageTitles[location.pathname] ?? "Hospital ERP"

  return (
    <div className="bg-slate-50 flex min-h-screen">
      {/* ส่งสิทธิ์ผู้ใช้ไปยัง Sidebar (ตรวจสอบ Type เรียบร้อยจากต้นทาง) */}
      <Sidebar userRole={role} />

      <div className="flex flex-1 flex-col">
        {/* ส่งหัวข้อที่คำนวณตาม Path ไปยัง Header */}
        <Header title={title} />

        {/* Content Area */}
        <main className="p-6 flex-1">
          {/* ส่วนแสดงผล Component ของแต่ละหน้าย่อยที่วิ่งผ่าน Router */}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
