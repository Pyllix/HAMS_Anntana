import { useEffect, useState } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import Login from "../pages/Login";
import TwoFactorEnrollment from "../pages/TwoFactorEnrollment";
import TwoFactorLogin from "../pages/TwoFactorLogin";
import ProtectedRoute, {
  AuthEntryRoute,
  PreAuthRoute,
} from "../router/ProtectedRoute";
import AppLayout from "../layout/AppLayout";
import { useAuthStore } from "../stores/authStore";

import { APP_ROUTE } from "../router/routes.config";
import Spinner from "../components/loader/Spinner";
import { initializeSessionDraftTab } from "../services/sessionDraftStorage";
import { getCurrentAuthState } from "../services/authService";
import { establishClientSession } from "../services/clientAuthState";
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
  {
    path: "/login",
    element: (
      <AuthEntryRoute>
        <Login />
      </AuthEntryRoute>
    ),
  },
  {
    path: "/2fa/enroll",
    element: (
      <PreAuthRoute requiredStep="ENROLLMENT">
        <TwoFactorEnrollment />
      </PreAuthRoute>
    ),
  },
  {
    path: "/2fa/verify",
    element: (
      <PreAuthRoute requiredStep="TOTP">
        <TwoFactorLogin />
      </PreAuthRoute>
    ),
  },
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

  const logout = useAuthStore((state) => state.logout);
  const enterPreAuth = useAuthStore((state) => state.enterPreAuth);

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      try {
        await initializeSessionDraftTab();
        const current = await getCurrentAuthState();
        if (!active) return;

        if (current.kind === "authenticated") {
          establishClientSession(current);
        } else if (current.kind === "pre-auth") {
          enterPreAuth(current.step);
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
  }, [logout, enterPreAuth]);

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
