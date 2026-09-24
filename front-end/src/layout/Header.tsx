import { useAuthStore } from "../stores/authStore";
import NotificationBell from "../components/notifications/NotificationBell";
import { matchPath, useLocation } from "react-router-dom";
import { APP_ROUTE } from "../router/routes.config";

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
    // 1. เปลี่ยนเป็น <header> เพื่อ Semantic HTML ที่ดี
    // 2. ปรับ Padding ให้ยืดหยุ่นตามขนาดจอ (px-4 ถึง px-8) และเอา h-22 ที่ไม่มีใน Tailwind ออก
    <header className="sticky top-0 z-20 flex w-full shrink-0 items-center justify-between bg-bg-component px-4 py-3 shadow-sm md:px-6 lg:px-8">
      {/* title */}
      {/* 3. เพิ่ม truncate เผื่อกรณีชื่อหัวข้อเปิดในจอมือถือแล้วยาวเกินไป จะได้ไม่ดัน Layout พัง */}
      <h1 className="text-xl font-bold text-slate-800 sm:text-2xl truncate pr-4">
        {headerTitle}
      </h1>

      {/* user & notification */}
      <div className="flex items-center gap-3 sm:gap-4 ml-auto shrink-0">
        {isRepairWorkPage && (
          <div className="flex items-center justify-center">
            <NotificationBell />
          </div>
        )}

        {/* Profile Section */}
        {/* 4. เพิ่มเส้นคั่น (border-l) ระหว่างกระดิ่งกับโปรไฟล์ให้ดูเป็นสัดส่วนแบบระบบ ERP */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-3 sm:pl-4">
          <img
            src={
              user?.imageUrl ??
              "https://static.vecteezy.com/system/resources/previews/018/765/757/original/user-profile-icon-in-flat-style-member-avatar-illustration-on-isolated-background-human-permission-sign-business-concept-vector.jpg"
            }
            alt="User"
            // ปรับขนาดรูปให้สัมพันธ์กับจอ (มือถือ w-9, คอม w-10) และเพิ่ม border บางๆ ให้กลืนกับพื้นหลัง
            className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover shadow-sm sm:h-10 sm:w-10"
          />

          {/* 5. ซ่อนชื่อในหน้าจอมือถือขนาดเล็กสุด (hidden sm:flex) เพื่อไม่ให้ล้นจอ */}
          <div className="hidden flex-col justify-center sm:flex">
            {/* เปลี่ยน text-md (ไม่มีใน Tailwind) เป็น text-sm และปรับระยะบรรทัด */}
            <span className="text-sm font-semibold leading-none tracking-tight text-slate-800">
              {user?.firstname} {user?.lastname}
            </span>
            <span className="mt-1 text-xs font-medium tracking-wide text-slate-500">
              {user?.role}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
