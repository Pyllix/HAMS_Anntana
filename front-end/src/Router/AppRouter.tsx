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
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
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
  return <RouterProvider router={router} />;
}
