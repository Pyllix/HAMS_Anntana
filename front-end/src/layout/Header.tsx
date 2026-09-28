import { Shield } from "lucide-react";
import NotificationBell from "../components/notifications/NotificationBell";
import { matchPath, NavLink, useLocation } from "react-router-dom";
import { APP_ROUTE } from "../router/routes.config";
import { useAuthStore } from "../stores/authStore";
import { ROLE_LABELS } from "../router/roles";

export default function Header() {
  const user = useAuthStore((state) => state.user);
  const { pathname } = useLocation();

  const currentRoute = APP_ROUTE.find((route) => {
    const routePattern = route.path.startsWith("/")
      ? route.path
      : "/" + route.path;
    return matchPath({ path: routePattern, end: false }, pathname);
  });
  const headerTitle = currentRoute?.title ?? "ระบบการจัดการ";
  const isRepairWorkPage = pathname === "/accept-work";

  return (
    <header className="sticky top-0 z-20 flex w-full shrink-0 items-center justify-between bg-bg-component px-4 py-3 shadow-sm md:px-6 lg:px-8">
      <h1 className="truncate pr-4 text-xl font-bold text-slate-800 sm:text-2xl">
        {headerTitle}
      </h1>
      <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
        {isRepairWorkPage && <NotificationBell />}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-3 sm:pl-4">
          <img
            src={
              user?.imageUrl ??
              "https://static.vecteezy.com/system/resources/previews/018/765/757/original/user-profile-icon-in-flat-style-member-avatar-illustration-on-isolated-background-human-permission-sign-business-concept-vector.jpg"
            }
            alt="User"
            className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover shadow-sm sm:h-10 sm:w-10"
          />
          <div className="hidden flex-col justify-center sm:flex">
            <span className="text-sm font-semibold leading-none tracking-tight text-slate-800">
              {user?.firstname} {user?.lastname}
            </span>
            <span className="mt-1 text-xs font-medium tracking-wide text-slate-500">
              {user?.role ? (ROLE_LABELS[user.role] ?? user.role) : ""}
            </span>
          </div>
          <NavLink
            to="/account-security"
            aria-label="ความปลอดภัยบัญชี"
            title="ความปลอดภัยบัญชี"
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
                isActive
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`
            }
          >
            <Shield className="h-4 w-4" />
            <span className="hidden lg:inline">ความปลอดภัยบัญชี</span>
          </NavLink>
        </div>
      </div>
    </header>
  );
}
