import { createBrowserRouter, RouterProvider } from "react-router-dom"
import ProtectedRoute from "./ProtectedRoute"
import AppLayout from "@/components/layout/AppLayout"
import LoginPage from "@/pages/auth/LoginPage"
import StockPage from "@/pages/Inventory/StockPage"
import Maintenance from "@/pages/Maintenance"
import Track from "@/pages/Track"
import History from "@/pages/History"
import ManagePage from "@/pages/Borrow/ManagePage"
import RequestPage from "@/pages/Borrow/RequestPage"

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
            children: [{ path: "/2", element: <RequestPage /> }],
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
            children: [{ path: "/history", element: <History /> }],
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
