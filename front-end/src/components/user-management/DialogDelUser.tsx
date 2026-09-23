import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "../../types/TypeUser";
import { deleteUserById } from "../../services/userService";

const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  MAINTENANCE_STAFF: "MAINTENANCE_STAFF",
  ASSET_CENTER_STAFF: "ASSET_CENTER_STAFF",
  PARCEL_STAFF: "PARCEL_STAFF",
  DEPARTMENT_STAFF: "DEPARTMENT_STAFF",
};

export default function DialogDelUser({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}) {
  if (!isOpen) return null;

  const queryClient = useQueryClient();

  const { mutate: deleteUser, isPending } = useMutation({
    mutationFn: (userId: string) => deleteUserById(userId),
    onSuccess: (data) => {
      // เมื่อลบสำเร็จ ให้สั่งอัปเดต/ดึงข้อมูลตารางผู้ใช้ใหม่ทันที
      queryClient.invalidateQueries({ queryKey: ["users"] });
      alert(data.message || "ลบผู้ใช้เรียบร้อยแล้ว");
    },
    onError: (error) => {
      console.error("เกิดข้อผิดพลาดในการลบ:", error);
      alert("ไม่สามารถลบข้อมูลได้");
    },
  });

  const roleLabels: Record<string, string> = {
    [ROLES.ADMIN]: "ผู้ดูแลระบบ",
    [ROLES.MANAGER]: "ผู้จัดการ / หัวหน้างาน",
    [ROLES.MAINTENANCE_STAFF]: "ช่างซ่อมบำรุง",
    [ROLES.ASSET_CENTER_STAFF]: "เจ้าหน้าที่ศูนย์สินทรัพย์",
    [ROLES.PARCEL_STAFF]: "เจ้าหน้าที่พัสดุ",
    [ROLES.DEPARTMENT_STAFF]: "เจ้าหน้าที่ประจำแผนก",
  };

  const userRole = user?.role || "";
  const roleLabel = roleLabels[userRole] || userRole || "ผู้ใช้งานทั่วไป";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-xs">
      {/* กล่อง Dialog หลักตามสัดส่วน SVG */}
      <div className="relative w-full max-w-[576px] rounded-2xl bg-white p-8 shadow-2xl transition-all">
        {/* ไอคอนแจ้งเตือนถังขยะในวงกลมแดง */}
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 border-8 border-red-500/10">
          <svg
            className="h-10 w-10 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </div>

        {/* ส่วนข้อความ (Delete User & รายละเอียด) */}
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900">
            ยืนยันการลบผู้ใช้งาน?
          </h3>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed whitespace-normal">
            คุณแน่ใจหรือไม่ที่จะลบผู้ใช้งานรายนี้ออกจากระบบ
            ข้อมูลประวัติการทำงานของเขาจะยังคงถูกเก็บไว้เป็นประวัติการทำรายการ
          </p>
          {/* กล่องแสดงข้อมูลผู้ใช้ที่เลือก พร้อมป้ายบอกบทบาท/แผนก */}
          {user && (
            <div className="mt-5 p-4 bg-gray-50 rounded-xl border border-gray-100 text-left flex items-center justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 overflow-hidden">
                  {user.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user.firstname.charAt(0)
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {user.firstname} {user.lastname}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>

              {/* Badge แสดง Role / แผนกภาษาไทย */}
              <span className="shrink-0 ml-2 inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white text-slate-700 shadow-xs">
                {roleLabel}
              </span>
            </div>
          )}
        </div>

        {/* แผงปุ่มกด Cancel / Delete ด้านล่าง */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 bg-white py-3.5 text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (user) {
                deleteUser(user.id);
              }
              onClose();
            }}
            className="flex-1 rounded-xl bg-red-500 py-3.5 text-sm font-semibold text-white shadow-xs hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
