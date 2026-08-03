import { Box, Mail, Lock } from "lucide-react";
import { useState } from "react";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  return (
    /* container หลัก */
    <div className="min-h-screen w-full flex justify-center items-center bg-bg-app antialiased">
      {/* ตัวเเบ่งซ้ายขวา */}
      <div className="relative overflow-hidden flex justify-between max-w-3xl w-full h-125 bg-bg-component rounded-3xl shadow-xl">
        {/* ซ้าย */}
        <div className="relative overflow-hidden flex-1 flex flex-col gap-3 justify-center items-center bg-emerald-600 text-white p-8">
          {/* กลมๆ 2 ลูก */}
          <div className="absolute  top-[-15%] left-[-5%] w-60 h-60 bg-emerald-900/40 rounded-full  pointer-events-none"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-60 h-60 bg-emerald-500/40 rounded-full pointer-events-none"></div>
          <Box className="w-10 h-10" />
          {/*  */}
          <div className="space-y-3">
            <h1 className="text-2xl text-center font-bold tracking-tight">
              ระบบจัดการครุภัณฑ์
            </h1>
            <p className="text-sm text-center font-normal leading-relaxed">
              บริหารจัดการทรัพยากรและอุปกรณ์ <br />{" "}
              ขององค์กรได้อย่างมีประสิทธิภาพ
            </p>
          </div>
        </div>
        {/* ขวา */}
        <div className="flex-1 p-8 flex flex-col gap-3 justify-center ">
          {/*  */}
          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              ยินดีต้อนรับเข้าสู่ระบบ
            </h1>
            <p className="text-sm font-normal text-slate-400 leading-relaxed">
              กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบ
            </p>
          </div>
          {/* form */}
          <form action="" className="space-y-3">
            {/* Input: ชื่อผู้ใช้ */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                ชื่อผู้ใช้
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <input
                  type="email"
                  placeholder="admin@company.com"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
            {/* Input: รหัสผ่าน */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                รหัสผ่าน
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
            {/* ปุ่ม login */}
            <button
              type="submit"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all mt-4"
            >
              เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
