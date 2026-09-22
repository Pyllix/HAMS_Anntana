import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Department, DepartmentDto } from "../../types/TypeDepartment";
import { updateDepartment } from "../../services/departmentService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  department: Department | null;
}

const emptyForm: DepartmentDto = {
  code: "",
  name: "",
  tel: "",
  building: "",
};

export default function DialogEditDepartment({
  isOpen,
  onClose,
  department,
}: Props) {
  const [form, setForm] = useState<DepartmentDto>(emptyForm);
  const queryClient = useQueryClient();

  // เติมข้อมูลเดิมของแผนกลงฟอร์มทุกครั้งที่เปิด dialog หรือเปลี่ยนแผนกที่จะแก้ไข
  useEffect(() => {
    if (department) {
      setForm({
        code: department.code,
        name: department.name,
        tel: department.tel ?? "",
        building: department.building ?? "",
      });
    }
  }, [department]);

  const { mutate: editDepartment, isPending } = useMutation({
    mutationFn: (dto: DepartmentDto) => {
      if (!department) throw new Error("ไม่พบข้อมูลแผนกที่จะแก้ไข");
      return updateDepartment(department.id, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      onClose();
    },
    onError: (error) => {
      console.error("เกิดข้อผิดพลาดในการแก้ไขแผนก:", error);
      alert("ไม่สามารถบันทึกการแก้ไขได้ (รหัสแผนกอาจซ้ำกับที่มีอยู่แล้ว)");
    },
  });

  if (!isOpen || !department) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    editDepartment({
      code: form.code,
      name: form.name,
      tel: form.tel || undefined,
      building: form.building || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2937]/60 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-[600px] bg-white rounded-[24px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between px-8 py-6 border-b border-[#E5E7EB]">
          <div>
            <h3 className="text-2xl font-bold text-[#1F2937]">
              แก้ไขข้อมูลแผนก
            </h3>
            <p className="mt-1 text-sm text-[#1F2937]/60">
              กรอกข้อมูลรายละเอียด
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
            {/* ชื่อแผนก */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                ชื่อแผนก <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                maxLength={255}
                value={form.name}
                onChange={handleChange}
                placeholder="เช่น ศูนย์คอมพิวเตอร์"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900 placeholder-gray-400"
              />
            </div>

            {/* รหัสแผนก / ตัวย่อแผนก */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                รหัสแผนก / ตัวย่อแผนก <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                name="code"
                required
                maxLength={20}
                value={form.code}
                onChange={handleChange}
                placeholder="เช่น ADM, IT, ER"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900 placeholder-gray-400"
              />
            </div>

            {/* เบอร์โทรศัพท์ภายใน */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                เบอร์โทรศัพท์ภายใน <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                name="tel"
                required
                maxLength={20}
                value={form.tel}
                onChange={handleChange}
                placeholder="123, 116"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900 placeholder-gray-400"
              />
            </div>

            {/* อาคาร/สถานที่ตั้ง */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                อาคาร / สถานที่ตั้ง <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                name="building"
                required
                maxLength={100}
                value={form.building}
                onChange={handleChange}
                placeholder="เช่น อาคาร 1 ชั้น 2"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900 placeholder-gray-400"
              />
            </div>
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
