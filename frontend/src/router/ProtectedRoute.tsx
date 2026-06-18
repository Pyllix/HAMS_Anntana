import { Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import type { UserRole } from "@/types/user"

export default function ProtectedRoute({
  allowedRoles,
}: {
  allowedRoles?: UserRole[]
}) {
  const { isAuthenticated, role } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
