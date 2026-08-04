import { useAuthStore } from "../stores/authStore";

export default function Header() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex justify-between items-center h-22 py-4 px-14 bg-bg-component shrink-0 shadow-sm">
      {/* title */}
      <h1 className="text-2xl font-bold">ระบบการจัดการ</h1>
      {/* user */}
      <div className="flex items-center gap-4">
        <img
          src={user?.image_url ?? undefined}
          alt="User"
          className="w-8 h-8 rounded-full shadow-md object-cover"
        />
        <div>
          <h1 className="text-md font-semibold tracking-tight">
            {user?.first_name} {user?.last_name}
          </h1>
          <p className="text-xs text-slate-500 font-light tracking-wide">{user?.role}</p>
        </div>
      </div>
    </div>
  );
}
