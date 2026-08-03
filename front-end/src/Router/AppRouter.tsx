import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import Login from "../Pages/Login";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
