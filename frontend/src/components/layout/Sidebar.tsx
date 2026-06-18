// src/components/Sidebar.tsx
import {
  FileCheck,
  Package,
  Hammer,
  History,
  SearchCheck,
  LogOut,
  FilePlus,
  type LucideIcon,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types/user"
import { useAuthStore } from "@/stores/authStore"
import { useNavigate } from "react-router-dom"

interface NavItem {
  label: string
  icon: LucideIcon
  path: string
  roles: Exclude<UserRole, null>[]
}

interface SidebarProps {
  userRole: UserRole
}

const navItems: NavItem[] = [
  {
    label: "ยืม - คืนครุภัณฑ์",
    icon: FileCheck,
    path: "/",
    roles: ["admin"],
  },
  {
    label: "ยืม - คืนครุภัณฑ์",
    icon: FilePlus,
    path: "/2",
    roles: ["admin"],
  },
  {
    label: "จัดการสต็อกครุภัณฑ์",
    icon: Package,
    path: "/inventory",
    roles: ["admin"],
  },
  {
    label: "แจ้งซ่อมครุภัณฑ์ ",
    icon: Hammer,
    path: "/maintenance",
    roles: ["admin"],
  },
  {
    label: "ติดตามสถานะ",
    icon: SearchCheck,
    path: "/track",
    roles: ["admin"],
  },
  {
    label: "ประวัติการยืม",
    icon: History,
    path: "/history",
    roles: ["admin"],
  },
]

export default function Sidebar({ userRole }: SidebarProps) {
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  const filtered = navItems.filter(
    (item) => userRole && item.roles.includes(userRole as any)
  )

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <aside className="flex min-h-screen w-54 flex-col bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-slate-700 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
          H
        </div>
        <span className="text-sm leading-tight font-semibold">
          ระบบครุภัณฑ์
          <br />
          <span className="font-normal text-slate-400">ERP System</span>
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 space-y-2 px-3 py-4">
        {filtered.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )
            }
          >
            <item.icon size={18} />
            <span className="flex-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      {/* Logout Button */}
      <div className="px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut size={18} />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  )
}
