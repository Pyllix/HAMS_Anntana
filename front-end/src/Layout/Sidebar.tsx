import {
  Box,
  Repeat,
  Archive,
  Wrench,
  History,
  LucideIcon,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { NavLink } from "react-router-dom";

interface NavItem {
  title: string;
  icon: LucideIcon;
  path: string;
  roles?: string[];
}

export default function Sidebar() {
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);

  const NAV_ITEMS: NavItem[] = [
    {
      title: "ยืม-คืนครุภัณฑ์",
      path: "/borrow-return",
      icon: Repeat,
      roles: ["admin", "staff", "user"],
    },
    {
      title: "จัดการสต็อกครุภัณฑ์",
      path: "/asset-stock",
      icon: Archive,
      roles: ["admin", "staff"],
    },
    {
      title: "จัดการสต็อกอะไหล่",
      path: "/part-stock",
      icon: Wrench,
      roles: ["admin", "staff"],
    },
    {
      title: "แจ้งซ่อมครุภัณฑ์",
      path: "/maintenance-request",
      icon: Wrench,
      roles: ["admin", "staff", "user"],
    },
    {
      title: "ติดตามสถานะ",
      path: "/track-status",
      icon: History,
      roles: ["admin", "staff", "user"],
    },
    {
      title: "ประวัติการยืม",
      path: "/borrow-history",
      icon: History,
      roles: ["admin", "staff", "user"],
    },
  ];

  const fillterNavItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return role ? item.roles.includes(role) : false;
  });

  return (
    // ตัวจัดการ layout ของ sidebar
    <div className="flex flex-col h-full w-60 bg-slate-900 shrink-0">
      {/* Logo */}
      <div className="flex justify-center items-center gap-2 text-white p-4 border-b border-slate-400/20">
        <a href="">
          <Box className="w-8 h-8" />
        </a>
        <h1 className="text-2xl tracking-tight">ระบบครุภัณฑ์</h1>
      </div>
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {fillterNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-4 rounded-lg text-md font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.title}</span>
            </NavLink>
          );
        })}
      </nav>
      {/* logout */}
      <div className="p-4 border-slate-400/20">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </div>
  );
}
