import { useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserDto } from "../../types/TypeUser";
import { createUser } from "../../services/userService";
import { getSections } from "../../services/assetService";
import { ROLES, RoleType } from "../../router/roles";

interface Props {
  isOpenAdd: boolean;
  onClose: () => void;
}

// รายการบทบาทเรียงลำดับตามที่แสดงในดรอปดาวน์ พร้อมคำอธิบายสิทธิ์การใช้งาน
export const ROLE_OPTIONS: { value: RoleType; label: string; description: string }[] = [
  {
    value: ROLES.MANAGER,
    label: "ผู้จัดการ / หัวหน้างาน",
    description: "สิทธิ์การใช้งาน: อนุมัติคำขอ ดูรายงานสรุป และกำกับดูแลการทำงานของหน่วยงาน",
  },
  {
    value: ROLES.ASSET_CENTER_STAFF,
    label: "เจ้าหน้าที่ครุภัณฑ์",
    description: "สิทธิ์การใช้งาน: เพิ่ม/แก้ไขข้อมูลครุภัณฑ์ จัดการยืม-คืน และบันทึกสถานะงานซ่อม",
  },
  {
    value: ROLES.MAINTENANCE_STAFF,
    label: "ช่างซ่อมบำรุง",
    description: "สิทธิ์การใช้งาน: รับงานซ่อม บันทึกผลการซ่อมบำรุง และอัปเดตสถานะครุภัณฑ์",
  },
  {
    value: ROLES.PARCEL_STAFF,
    label: "เจ้าหน้าที่พัสดุ",
    description: "สิทธิ์การใช้งาน: บันทึกรับ-ส่งพัสดุ และติดตามสถานะการจัดส่ง",
  },
  {
    value: ROLES.DEPARTMENT_STAFF,
    label: "เจ้าหน้าที่ประจำแผนก",
    description: "สิทธิ์การใช้งาน: ยืม-คืนครุภัณฑ์ และแจ้งซ่อมภายในหน่วยงานของตนเอง",
  },
  {
    value: ROLES.ADMIN,
    label: "ผู้ดูแลระบบ",
    description: "สิทธิ์การใช้งาน: จัดการผู้ใช้งาน ตั้งค่าระบบ และเข้าถึงข้อมูลทั้งหมดในระบบ",
  },
];

const initialForm = {
  fullName: "",
  email: "",
  sectionId: "",
  role: ROLES.ASSET_CENTER_STAFF as RoleType,
  password: "",
  confirmPassword: "",
};

export default function DialogAddUser({ isOpenAdd, onClose }: Props) {
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const queryClient = useQueryClient();

  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: () => getSections(),
    enabled: isOpenAdd,
  });

  const { mutate: addUser, isPending } = useMutation({
    mutationFn: (user: UserDto) => createUser(user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setForm(initialForm);
      onClose();
    },
    onError: (error) => {
      console.error("เกิดข้อผิดพลาดในการเพิ่มผู้ใช้งาน:", error);
      alert("ไม่สามารถเพิ่มผู้ใช้งานได้");
    },
  });

  if (!isOpenAdd) return null;

  const selectedRole =
    ROLE_OPTIONS.find((option) => option.value === form.role) ?? ROLE_OPTIONS[0];

  // ผู้ดูแลระบบไม่จำเป็นต้องสังกัดหน่วยงาน
  const isSectionRequired = form.role !== ROLES.ADMIN;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    setForm(initialForm);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      alert("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    const [firstname, ...rest] = form.fullName.trim().split(/\s+/);
    const lastname = rest.join(" ");

    addUser({
      userName: form.email.split("@")[0],
      firstname: firstname || "",
      lastname,
      email: form.email,
      password: form.password,
      role: form.role,
      ...(isSectionRequired && form.sectionId && { sectionId: form.sectionId }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2937]/60 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-[600px] bg-white rounded-[24px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between px-8 py-6 border-b border-[#E5E7EB]">
          <div>
            <h3 className="text-2xl font-bold text-[#1F2937]">
              เพิ่มผู้ใช้งานใหม่
            </h3>
            <p className="mt-1 text-sm text-[#1F2937]/60">
              กรอกข้อมูลรายละเอียดผู้ใช้งานและกำหนดสิทธิ์การเข้าถึงระบบ
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-8 space-y-5"
        >
          {/* ชื่อ-นามสกุล */}
          <div>
            <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
              ชื่อ-นามสกุล <span className="text-emerald-600">*</span>
            </label>
            <input
              type="text"
              name="fullName"
              required
              value={form.fullName}
              onChange={handleChange}
              placeholder="เช่น สมชาย ระบบดี"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900 placeholder-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* อีเมล */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                อีเมล (Email) <span className="text-emerald-600">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="email@company.com"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900 placeholder-gray-400"
              />
            </div>

            {/* หน่วยงาน/แผนก */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                หน่วยงาน/แผนก{" "}
                {isSectionRequired ? (
                  <span className="text-emerald-600">*</span>
                ) : (
                  <span className="text-xs font-normal text-gray-400">
                    (ไม่ต้องระบุ)
                  </span>
                )}
              </label>
              <select
                name="sectionId"
                required={isSectionRequired}
                disabled={!isSectionRequired}
                value={isSectionRequired ? form.sectionId : ""}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <option value="" disabled={isSectionRequired}>
                  {isSectionRequired
                    ? "-- โปรดเลือกหน่วยงาน --"
                    : "-- ผู้ดูแลระบบไม่ต้องระบุหน่วยงาน --"}
                </option>
                {sections?.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ระดับผู้ใช้งาน (Role) */}
          <div>
            <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
              ระดับผู้ใช้งาน (Role) <span className="text-emerald-600">*</span>
            </label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-emerald-500 bg-emerald-50/40 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-emerald-700"
            >
              {ROLE_OPTIONS.map((option, index) => (
                <option key={option.value} value={option.value}>
                  {`${index + 1}. ${option.label}`}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-[#1F2937]/70">
              {selectedRole.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* รหัสผ่าน */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                รหัสผ่าน <span className="text-emerald-600">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* ยืนยันรหัสผ่าน */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                ยืนยันรหัสผ่าน <span className="text-emerald-600">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  required
                  minLength={8}
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label={
                    showConfirmPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-6 flex items-center justify-end gap-3 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700/70 text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
