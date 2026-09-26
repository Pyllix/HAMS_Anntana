import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import Login from "../pages/Login";
import ProtectedRoute from "../router/ProtectedRoute";
import AppLayout from "../layout/AppLayout";
import AdminBorrowReturn from "../pages/AssetCenterBorrowReturn";
import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import UserBorrowReturn from "../pages/DepartMentBorrowReturn";
import { APP_ROUTE } from "../router/routes.config";
import Spinner from "../components/loader/Spinner";
import {
  associateSessionDraftAccount,
  initializeSessionDraftTab,
} from "../services/sessionDraftStorage";
import { getCurrentSession } from "../services/authService";
import { publishAuthMessage } from "../services/authBroadcast";
import SessionLifecycle from "../components/auth/SessionLifecycle";

function RootRedirect() {
  const role = useAuthStore((state) => state.role);
  const defaultRoute = APP_ROUTE.find(
    (route) => role && route.roles.includes(role),
  );
  return (
    <Navigate
      to={defaultRoute ? "/" + defaultRoute.path : "/unauthorized"}
      replace
    />
  );
}

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <RootRedirect /> },
          ...APP_ROUTE.map((route) => ({
            element: <ProtectedRoute allowedRoles={route.roles} />,
            children: [{ path: route.path, element: route.element }],
          })),
        ],
      },
    ],
  },
  {
    path: "/unauthorized",
    element: <div>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>,
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function AppRouter() {
  const [isInitializing, setIsInitializing] = useState(true);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      try {
        await initializeSessionDraftTab();
        const current = await getCurrentSession();
        if (!active) return;

        if (current) {
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
          associateSessionDraftAccount(current.user.id);
          login(current.user, current.session);
          publishAuthMessage({
            type: "ACCOUNT_CHANGED",
            userId: current.user.id,
          });
        } else {
          logout();
        }
      } catch {
        // Fail closed: without a server-confirmed session, protected routes stay hidden.
        logout();
      } finally {
        if (active) setIsInitializing(false);
      }
    };

    void initializeAuth();
    return () => {
      active = false;
    };
  }, [login, logout]);

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center gap-2 bg-bg-app text-slate-500">
        <Spinner className="h-6 w-6" />
        กำลังโหลด...
      </div>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <SessionLifecycle />
    </>
  );
}