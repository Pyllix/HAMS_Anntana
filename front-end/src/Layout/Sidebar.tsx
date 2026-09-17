import { useAuthStore } from "../stores/authStore";
import { NavLink } from "react-router-dom";
import { APP_ROUTE } from "../Router/routes.config";
import { Box, LogOut } from "lucide-react";

export default function Sidebar() {
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);

  const navItems = APP_ROUTE.filter(
    (item) => item.showInNav && role && item.roles.includes(role),
  );

  return (
    // ตัวจัดการ layout ของ sidebar (เพิ่ม overflow-hidden เพื่อป้องกันไม่ให้เลื่อนทั้งกล่อง)
    <div className="flex flex-col h-full w-60 bg-slate-900 shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="flex justify-center items-center gap-2 text-white p-4 border-b border-slate-400/20 shrink-0">
        <a href="">
          <Box className="w-8 h-8" />
        </a>
        <h1 className="text-2xl tracking-tight">ระบบครุภัณฑ์</h1>
      </div>

      {/* Navigation (เพิ่ม scrollbar-none หรือจัดการ overflow-y ให้สะอาดขึ้น) */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
        {navItems.map((item) => {
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
              {Icon && <Icon className="w-5 h-5 shrink-0" />}
              <span className="truncate">{item.title}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* logout */}
      <div className="p-4 border-t border-slate-400/20 shrink-0">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="truncate">ออกจากระบบ</span>
        </button>
      </div>
    </div>
  );
}
