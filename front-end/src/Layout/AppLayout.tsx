import Sidebar from "./Sidebar";
import Header from "./Header";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg-app">
      {/* สมมติว่า Sidebar มีการจัดการ Responsive ภายในตัวเองแล้ว */}
      <Sidebar />

      {/* ลบ Space ว่างด้านหลัง overflow-hidden ออกเพื่อความสะอาดของโค้ด */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        {/* 
        1. ปรับ Padding ให้เหมาะกับขนาดจอ (Responsive)
        2. เอา space-y-4 ออก (ให้ Page ด้านในจัดการตัวเอง)
        3. อาจเพิ่มคลาส custom scrollbar ถ้าต้องการ 
      */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
