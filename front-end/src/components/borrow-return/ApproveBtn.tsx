import { useMutation, useQueryClient } from "@tanstack/react-query";
import { approveBorrow } from "../../services/borrowService";

export default function ApproveBtn({
  transactionId,
}: {
  transactionId: string;
}) {
  console.log("ApproveBtn transactionId:", transactionId); // Debugging log
  const queryClient = useQueryClient();
  const { mutate: handleApprove } = useMutation({
    mutationFn: () => approveBorrow(transactionId),
    onSuccess: (data) => {
      alert("อนุมัติการยืมครุภัณฑ์สำเร็จเรียบร้อย");
      console.log("Approve success:", data);

      // Invalidate queries เพื่อดึงข้อมูลสถานะล่าสุดมาแสดงใหม่
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["borrowings"] });
    },
    onError: (err: any) => {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "เกิดข้อผิดพลาดในการอนุมัติรายการ";
      alert(`ไม่สามารถทำรายการได้: ${errorMsg}`);
    },
  });

  return (
    <button
      type="button"
      onClick={() => handleApprove()}
      className="w-24 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cyan-700"
    >
      รออนุมัติ
    </button>
  );
}
