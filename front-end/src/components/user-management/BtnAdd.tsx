import { Plus } from "lucide-react";

export default function BtnAdd({ clickOpen }: { clickOpen: () => void }) {
  return (
    <button
      onClick={clickOpen}
      className="inline-flex items-center justify-center gap-3 bg-[#009660] hover:bg-[#007f51] text-white font-medium px-4 py-2 rounded-2xl shadow-sm transition-all duration-200 active:scale-95"
    >
      <Plus className="w-5 h-5" />
      <span className="text-xl">เพิ่มผู้ใช้ใหม่</span>
    </button>
  );
}
