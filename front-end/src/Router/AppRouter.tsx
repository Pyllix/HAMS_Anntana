import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import Login from "../Pages/Login";
import ProtectedRoute from "../Router/ProtectedRoute";
import AppLayout from "../layout/AppLayout";
import AdminBorrowReturn from "../Pages/AssetCenterBorrowReturn";
import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import axios from "axios";
import UserBorrowReturn from "../Pages/DepartMentBorrowReturn";
import { APP_ROUTE } from "../Router/routes.config";

// Function สำหรับหา Path ที่ User จะต้องไป
function RootRedirect() {
  const role = useAuthStore((state) => state.role);
  const defaultRoute = APP_ROUTE.find(
    (route) => role && route.roles.includes(role),
  );
  return (
    <Navigate
      to={defaultRoute ? `/${defaultRoute.path}` : "/unauthorized"}
      replace
    />
  );
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <RootRedirect />,
          },
          ...APP_ROUTE.map((route) => ({
            element: <ProtectedRoute allowedRoles={route.roles} />,
            children: [
              {
                path: route.path,
                element: route.element,
              },
            ],
          })),
        ],
      },
    ],
  },
  {
    path: "/unauthorized",
    element: <div>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default function AppRouter() {
  const [isInitializing, setIsInitializing] = useState(true);
  const { login, logout } = useAuthStore();

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId");

      if (token && userId) {
        try {
          const userResponse = await axios.get(
            `https://hams-anntana.onrender.com/users/${userId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );
          login(userResponse.data, token);
        } catch (error) {
          console.error("Auto login failed, token might be expired.", error);
          logout();
        }
      }
      setIsInitializing(false);
    };

    initializeAuth();
  }, [login, logout]);

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg-app">
        กำลังโหลด...
      </div>
    );
  }
  return <RouterProvider router={router} />;
}
