import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { routeForPreAuthStep, type PreAuthStep } from "../types/AuthFlow";
import type { RoleType } from "../router/roles";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  allowedRoles?: RoleType[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, preAuthStep, role } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to={preAuthStep ? routeForPreAuthStep(preAuthStep) : "/login"} replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

export function AuthEntryRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, preAuthStep } = useAuthStore();
  if (preAuthStep) return <Navigate to={routeForPreAuthStep(preAuthStep)} replace />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export function PreAuthRoute({
  requiredStep,
  children,
}: {
  requiredStep: PreAuthStep;
  children: ReactNode;
}) {
  const { isAuthenticated, preAuthStep } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/" replace />;
  if (!preAuthStep) return <Navigate to="/login" replace />;
  if (preAuthStep !== requiredStep) {
    return <Navigate to={routeForPreAuthStep(preAuthStep)} replace />;
  }
  return children;
}
