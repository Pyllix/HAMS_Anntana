import { useAuthStore } from "../stores/authStore";
import NotificationBell from "../components/notifications/NotificationBell";
import { matchPath, useLocation } from "react-router-dom";
import { APP_ROUTE } from "../Router/routes.config";

export default function Header() {
  const user = useAuthStore((state) => state.user);
  const { pathname } = useLocation();

  // หา Route ที่ตรงกับ URL ปัจจุบัน แล้วดึง title มาใช้
  const currentRoute = APP_ROUTE.find((route) => {
    // ใส่ "/" ข้างหน้า path ถ้ายังไม่มี เพื่อให้ match กับ pathname ของ react-router
    const routePattern = route.path.startsWith("/")
      ? route.path
      : `/${route.path}`;
    return matchPath({ path: routePattern, end: false }, pathname);
  });

  const headerTitle = currentRoute?.title ?? "ระบบการจัดการ";

  const isRepairWorkPage = pathname === "/accept-work";

  return (
    <div className="flex justify-between items-center h-22 py-4 px-14 bg-bg-component shrink-0 shadow-sm">
      {/* title */}
      <h1 className="text-2xl font-bold">{headerTitle}</h1>

      {/* user */}
      <div className="flex items-center gap-4">
        {isRepairWorkPage && <NotificationBell />}

        <img
          src={
            user?.imageUrl ??
            "https://static.vecteezy.com/system/resources/previews/018/765/757/original/user-profile-icon-in-flat-style-member-avatar-illustration-on-isolated-background-human-permission-sign-business-concept-vector.jpg"
          }
          alt="User"
          className="w-8 h-8 rounded-full shadow-md object-cover"
        />

        <div>
          <h1 className="text-md font-semibold tracking-tight">
            {user?.firstname} {user?.lastname}
          </h1>

          <p className="text-xs text-slate-500 font-light tracking-wide">
            {user?.role}
          </p>
        </div>
      </div>
    </div>
  );
}
