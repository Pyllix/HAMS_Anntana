import { Box, Mail, Lock } from "lucide-react";
import { useState } from "react";
import { authLogin } from "../services/authService";
import { useAuthStore } from "../stores/authStore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  //   e.preventDefault();
  //   const userLogin = authLogin(formData.email, formData.password);
  //   if (userLogin) {
  //     login(userLogin);
  //     console.log("authStore:", user);
  //     navigate("/", { replace: true });
  //   }
  // }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const loginData = await authLogin(formData.email, formData.password);

      if (loginData) {
        localStorage.setItem("token", loginData.token);
        localStorage.setItem("userId", loginData.user.id);

        login(loginData.user, loginData.token);

        console.log("Login Success!");
        navigate("/", { replace: true });
      }
    } catch (error) {
      console.error("Login Failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

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
          <form action="" className="space-y-3" onSubmit={handleSubmit}>
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
                  onChange={handleInputChange}
                  name="email"
                  value={formData.email}
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
                  type="password"
                  placeholder="••••••••"
                  onChange={handleInputChange}
                  name="password"
                  value={formData.password}
                  className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
            {/* ปุ่ม login */}
            <button
              disabled={isLoading}
              type="submit"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
