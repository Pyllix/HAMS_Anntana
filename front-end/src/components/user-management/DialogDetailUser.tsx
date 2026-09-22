import { X } from "lucide-react";
import { User } from "../../types/TypeUser";
import { getSectionById } from "../../services/sectionService";
import { useQuery } from "@tanstack/react-query";

interface DialogDetailUserProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

// แมปชื่อบทบาทภาษาไทย
const roleLabels: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  MANAGER: "ผู้จัดการ / หัวหน้างาน",
  MAINTENANCE_STAFF: "ช่างซ่อมบำรุง",
  ASSET_CENTER_STAFF: "เจ้าหน้าที่ศูนย์สินทรัพย์",
  PARCEL_STAFF: "เจ้าหน้าที่พัสดุ",
  DEPARTMENT_STAFF: "เจ้าหน้าที่ประจำแผนก",
};

export default function DialogDetailUser({
  isOpen,
  onClose,
  user,
}: DialogDetailUserProps) {
  if (!isOpen || !user) return null;

  const sectionId = user.section_id;

  const { data: section } = useQuery({
    queryKey: ["section", sectionId],
    queryFn: () => getSectionById(sectionId),
  });

  const fullName =
    `${user.firstname || ""} ${user.lastname || ""}`.trim() || "-";
  const initial = user.firstname ? user.firstname.charAt(0).toUpperCase() : "U";

  // ฟังก์ชันจัดรูปแบบวันที่ (เช่น 10 ก.ย. 2026 หรือ 10/09/2026)
  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    // 1. Backdrop (ความมืด 60% ตาม fill-opacity="0.6")
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 animate-in fade-in duration-200">
      {/* 2. Dialog Container (กว้าง 600px ตาม SVG) */}
      <div className="relative w-full max-w-[600px] overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header ส่วนหัว */}
        <div className="flex items-center justify-between border-b border-gray-200 px-8 py-5">
          <h2 className="text-xl font-bold text-gray-900">
            รายละเอียดผู้ใช้งาน
          </h2>
          {/* ปุ่มปิดกากบาทกล่องสี่เหลี่ยมสีเทา */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
          >
            <X className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Body เนื้อหา */}
        <div className="px-8 pt-6 pb-2">
          {/* ส่วน Profile ด้านบน: Avatar + ชื่อ + อีเมล + สถานะ */}
          <div className="flex items-center gap-5 pb-6">
            {/* รูป Avatar ขนาด 80x80px วงกลม */}
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 border border-blue-200">
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={fullName}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <span className="text-2xl font-bold text-blue-600">
                  {initial}
                </span>
              )}
            </div>

            {/* ข้อมูลชื่อและสถานะ */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xl font-bold text-gray-900 leading-snug">
                {fullName}
              </h3>
              <p className="text-sm font-medium text-gray-500">
                {user.email || `@${user.userName}`}
              </p>

              {/* Badge สถานะ (ตาม SVG: พื้นเขียวอ่อน จุดเขียว ตัวอักษรเขียวเข้ม) */}
              <div className="pt-1">
                {user.banned ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3.5 py-1 text-xs font-semibold text-rose-700">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    ระงับการใช้งาน
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    ใช้งานปกติ
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* กล่องข้อมูลตารางสีเทา (Gray Container) */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-6">
            <div className="grid grid-cols-2 gap-y-5 gap-x-8">
              {/* แถว 1: รหัสพนักงาน & เบอร์โทรศัพท์/ชื่อผู้ใช้ */}
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-1">
                  รหัสพนักงาน
                </dt>
                <dd className="font-mono text-sm font-bold text-gray-900">
                  {user.employeeId || "-"}
                </dd>
              </div>

              {/* แถว 2: สังกัด/หน่วยงาน & บทบาท (Role) */}
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-1">
                  หน่วยงาน / แผนก
                </dt>
                <dd className="text-sm font-semibold text-gray-900 whitespace-normal">
                  {section?.name ?? "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-1">
                  บทบาท (Role)
                </dt>
                <dd className="text-sm font-semibold text-gray-900">
                  {roleLabels[user.role] || user.role || "-"}
                </dd>
              </div>

              {/* แถว 3: วันที่สร้างบัญชี & แก้ไขล่าสุด */}
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-1">
                  วันที่สร้างบัญชี
                </dt>
                <dd className="text-sm font-semibold text-gray-900">
                  {formatDate(user.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-1">
                  แก้ไขล่าสุด
                </dt>
                <dd className="text-sm font-semibold text-gray-900">
                  {formatDate(user.updatedAt)}
                </dd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer ด้านล่าง พร้อมปุ่ม "ปิดหน้าต่าง" สีขาวขอบเทา */}
        <div className="flex justify-end border-t border-gray-200 px-8 py-4 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-8 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
