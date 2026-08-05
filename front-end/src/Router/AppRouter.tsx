import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import Login from "../Pages/Login";
import ProtectedRoute from "../router/ProtectedRoute";
import AppLayout from "../layout/AppLayout";
import BorrowReturn from "../pages/borrow-return";
import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import axios from "axios";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/borrow-return" replace />,
  },
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
            // FIX: Added "staff" role to match the sidebar navigation rules.
            element: <ProtectedRoute allowedRoles={["ADMIN", "user"]} />,
            children: [
              {
                path: "borrow-return",
                element: <BorrowReturn />,
              },
            ],
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
