import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import Login from "../Pages/Login";
import ProtectedRoute from "../router/ProtectedRoute";
import AppLayout from "../layout/AppLayout";
import BorrowReturn from "../pages/borrow-return";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/borrow-return" replace />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  // ชั้นที่ 1: เช็กแค่วาล็อกอินแล้วหรือยัง (Authentication)
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />, // ทุกหน้าข้างในนี้จะอยู่ภายใต้ Layout หลัก
        children: [
          // ชั้นที่ 2: เช็ก Role สำหรับแต่ละหน้า (Authorization)
          {
            element: <ProtectedRoute allowedRoles={["admin", "user"]} />,
            children: [
              {
                path: "borrow-return",
                element: <BorrowReturn />,
              },
              // เพิ่มหน้าอื่นๆ ที่นี่...
              // { path: "asset-stock", element: <AssetStock /> },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          {
            element: <ProtectedRoute />,
            children: [{ path: "/borrow-return", element: <BorrowReturn /> }],
          },
        ],
      },
    ],
  },
  {
    path: "/unauthorized",
    element: <div>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>,
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
