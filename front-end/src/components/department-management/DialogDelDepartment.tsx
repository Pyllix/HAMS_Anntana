import { TriangleAlert } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Department } from "../../types/TypeDepartment";
import { deleteDepartmentById } from "../../services/departmentService";

export default function DialogDelDepartment({
  isOpen,
  onClose,
  department,
}: {
  isOpen: boolean;
  onClose: () => void;
  department: Department | null;
}) {
  if (!isOpen) return null;

  const queryClient = useQueryClient();

  const { mutate: deleteDepartment, isPending } = useMutation({
    mutationFn: (id: string) => deleteDepartmentById(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      onClose();
    },
    onError: (error) => {
      console.error("เกิดข้อผิดพลาดในการลบ:", error);
      alert("ไม่สามารถลบข้อมูลได้ อาจมีผู้ใช้งานหรือครุภัณฑ์ผูกกับแผนกนี้อยู่");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-xs">
      {/* กล่อง Dialog หลัก */}
      <div className="relative w-full max-w-[576px] rounded-2xl bg-white p-8 shadow-2xl transition-all">
        {/* ไอคอนแจ้งเตือนในวงกลมแดง */}
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 border-8 border-red-500/10">
          <TriangleAlert className="h-10 w-10 text-red-500" strokeWidth={2.5} />
        </div>

        {/* ส่วนข้อความ */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900">
            ยืนยันการลบแผนก?
          </h3>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed whitespace-normal">
            คุณแน่ใจหรือไม่ที่จะลบแผนกนี้ออกจากระบบ
          </p>

          {/* กล่องแสดงข้อมูลแผนกที่เลือก */}
          {department && (
            <div className="mt-5 py-4 px-5 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <span className="text-sm font-bold text-gray-900">
                {department.code}
              </span>
              <span className="mx-2 text-base font-bold text-gray-900">
                {department.name}
              </span>
            </div>
          )}
        </div>

        {/* แผงปุ่มกด ยกเลิก / ยืนยันการลบข้อมูล ด้านล่าง */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 bg-white py-3.5 text-sm font-bold text-gray-700/70 shadow-xs hover:bg-gray-50 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (department) {
                deleteDepartment(department.id);
              }
            }}
            className="flex-1 rounded-xl bg-red-500 py-3.5 text-sm font-bold text-white shadow-xs hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? "กำลังลบ..." : "ยืนยันการลบข้อมูล"}
          </button>
        </div>

        {/* คำเตือนเงื่อนไขการลบ */}
        <p className="mt-4 text-center text-xs text-red-500/80">
          *หากมีผู้ใช้งาน หรือ ครุภัณฑ์ ใช้งานอยู่ไม่สามารถลบได้
          เนื่องจากยังมีผู้ใช้งานหรือครุภัณฑ์ผูกกับแผนกนี้อยู่
        </p>
      </div>
    </div>
  );
}
