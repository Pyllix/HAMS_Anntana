import { createBrowserRouter, RouterProvider } from "react-router-dom"
import ProtectedRoute from "./ProtectedRoute"
import AppLayout from "@/components/layout/AppLayout"
import LoginPage from "@/pages/auth/LoginPage"
import Dashboard from "@/pages/Dashboard"

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <Dashboard /> },
          {
            element: <ProtectedRoute allowedRoles={["admin", "pharmacist"]} />,
            children: [
              { path: "/inventory", element: <div>คลังครุภัณฑ์</div> },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [{ path: "/settings", element: <div>ตั้งค่าระบบ</div> }],
          },
        ],
      },
    ],
  },
  {
    path: "/unauthorized",
    element: <div>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>,
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
