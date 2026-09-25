import { useEffect, useState } from "react";
import { X } from "lucide-react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, UserDto } from "../../types/TypeUser";
import { updateUserById } from "../../services/userService";
import { getSections } from "../../services/assetService";
import { ROLES, RoleType } from "../../router/roles";
import { ROLE_OPTIONS } from "./DialogAddUser";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

const toForm = (user: User) => ({
  firstname: user.firstname ?? "",
  lastname: user.lastname ?? "",
  userName: user.userName ?? "",
  email: user.email ?? "",
  sectionId: user.section_id ?? "",
  role: user.role as RoleType,
});

export default function DialogEditUser({ isOpen, onClose, user }: Props) {
  const [form, setForm] = useState(() => toForm(user));

  const queryClient = useQueryClient();

  // รีเซ็ตฟอร์มให้ตรงกับข้อมูลผู้ใช้ล่าสุดทุกครั้งที่เปิด dialog
  useEffect(() => {
    if (isOpen) setForm(toForm(user));
  }, [isOpen, user]);

  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: () => getSections(),
    enabled: isOpen,
  });

  const { mutate: editUser, isPending } = useMutation({
    mutationFn: (payload: Partial<Omit<UserDto, "password">>) =>
      updateUserById(user.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      alert("แก้ไขข้อมูลผู้ใช้งานเรียบร้อยแล้ว");
      onClose();
    },
    onError: (error) => {
      console.error("เกิดข้อผิดพลาดในการแก้ไขผู้ใช้งาน:", error);
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        alert("อีเมลหรือชื่อผู้ใช้นี้ถูกใช้งานแล้ว");
        return;
      }
      alert("ไม่สามารถแก้ไขข้อมูลผู้ใช้งานได้");
    },
  });

  if (!isOpen) return null;

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    editUser({
      firstname: form.firstname.trim(),
      lastname: form.lastname.trim(),
      userName: form.userName.trim(),
      email: form.email.trim(),
      role: form.role,
      ...(isSectionRequired && form.sectionId && { sectionId: form.sectionId }),
    });
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900 placeholder-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2937]/60 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-[600px] bg-white rounded-[24px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between px-8 py-6 border-b border-[#E5E7EB]">
          <div>
            <h3 className="text-2xl font-bold text-[#1F2937]">
              แก้ไขข้อมูลผู้ใช้งาน
            </h3>
            <p className="mt-1 text-sm text-[#1F2937]/60">
              รหัสพนักงาน{" "}
              <span className="font-mono font-semibold">
                {user.employeeId || "-"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
          <div className="grid grid-cols-2 gap-5">
            {/* ชื่อ */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                ชื่อ <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                name="firstname"
                required
                value={form.firstname}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            {/* นามสกุล */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                นามสกุล
              </label>
              <input
                type="text"
                name="lastname"
                value={form.lastname}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* ชื่อผู้ใช้ */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                ชื่อผู้ใช้ (Username) <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                name="userName"
                required
                value={form.userName}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

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
                className={inputClass}
              />
            </div>
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
              className={`${inputClass} bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
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

          {/* Footer Buttons */}
          <div className="pt-6 flex items-center justify-end gap-3 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700/70 text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
