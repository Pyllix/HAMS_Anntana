import { createBrowserRouter, RouterProvider } from "react-router-dom"
import ProtectedRoute from "./ProtectedRoute"
import AppLayout from "@/components/layout/AppLayout"
import LoginPage from "@/pages/auth/LoginPage"
import StockPage from "@/pages/Inventory/StockPage"
import Maintenance from "@/pages/Maintenance"
import BorrowHistoryPage from "@/pages/Borrow/BorrowHistoryPage"
import ManagePage from "@/pages/Borrow/ManagePage"
import EquipmentBorrowPage from "@/pages/EquipmentBorrow/EquipmentBorrowPage"
// import DepartmentPage from "@/pages/settings/DepartmentPage"
import UserManagementPage from "@/pages/settings/UserManagementPage"
import Track from "@/pages/Track/TrackPage"

const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "/",
            element: <ManagePage />,
          },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [{ path: "/2", element: <EquipmentBorrowPage /> }],
          },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [{ path: "/inventory", element: <StockPage /> }],
          },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [{ path: "/inventory", element: <StockPage /> }],
          },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [{ path: "/maintenance", element: <Maintenance /> }],
          },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [{ path: "/track", element: <Track /> }],
          },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [{ path: "/history", element: <BorrowHistoryPage /> }],
          },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
<<<<<<< HEAD
            // children: [{ path: "/settings/departments", element: <DepartmentPage /> }],
=======
            children: [
              { path: "/settings/departments", element: <DepartmentPage /> },
            ],
>>>>>>> 4917130a1727da42db9343ea06ff215e397d33d5
          },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [
              { path: "/settings/users", element: <UserManagementPage /> },
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
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
