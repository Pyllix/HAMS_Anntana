// src/components/Sidebar.tsx
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Settings,
  ChevronRight,
  type LucideIcon,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"

// 1. กำหนดประเภทของ Role ให้ตรงกับระบบหลัก
type UserRole = "admin" | "pharmacist" | "nurse" | "doctor" | null

// 2. กำหนดโครงสร้างของแต่ละเมนูใน Sidebar
interface NavItem {
  label: string
  icon: LucideIcon // ใช้ Type ของ LucideIcon โดยเฉพาะสำหรับตัวแปรไอคอน
  path: string
  roles: Exclude<UserRole, null>[] // เอาทกตัวยกเว้น null เพื่อป้องกันการใส่ค่าผิดพลาด
}

// 3. กำหนด Props สำหรับ Component Sidebar
interface SidebarProps {
  userRole: UserRole
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/",
    roles: ["admin", "pharmacist", "nurse"],
  },
  {
    label: "คลังครุภัณฑ์",
    icon: Package,
    path: "/inventory",
    roles: ["admin", "pharmacist"],
  },
  {
    label: "รายการเบิก",
    icon: ClipboardList,
    path: "/requests",
    roles: ["admin", "pharmacist", "nurse"],
  },
  { label: "ตั้งค่า", icon: Settings, path: "/settings", roles: ["admin"] },
]

export default function Sidebar({ userRole }: SidebarProps) {
  // กรองเมนูตามสิทธิ์: ป้องกันบั๊กกรณี userRole เป็น null โดยเช็คเพิ่มก่อนคำสั่ง .includes
  const filtered = navItems.filter(
    (item) => userRole && item.roles.includes(userRole as any)
  )

  return (
    <aside className="w-64 bg-slate-900 text-white flex min-h-screen flex-col">
      {/* Logo */}
      <div className="gap-3 px-6 py-5 border-slate-700 flex items-center border-b">
        <div className="w-8 h-8 rounded-lg bg-blue-500 font-bold text-sm text-white flex items-center justify-center">
          H
        </div>
        <span className="font-semibold text-sm leading-tight">
          Hospital
          <br />
          <span className="text-slate-400 font-normal">ERP System</span>
        </span>
      </div>

      {/* Nav Items */}
      <nav className="px-3 py-4 space-y-1 flex-1">
        {filtered.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              cn(
                "gap-3 px-3 py-2.5 rounded-lg text-sm flex items-center transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )
            }
          >
            <item.icon size={18} />
            <span className="flex-1">{item.label}</span>
            <ChevronRight size={14} className="opacity-40" />
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
