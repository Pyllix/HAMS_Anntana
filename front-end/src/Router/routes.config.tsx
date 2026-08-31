import { Repeat, Archive, Wrench, History, LucideIcon } from "lucide-react";
import { ROLES, RoleType } from "./roles";
import AssetCenterBorrowReturn from "../Pages/AssetCenterBorrowReturn";
import AssetStock from "../Pages/AssetStock";
import PartStock from "../Pages/PartStock";
import PendingEvaluations from "../Pages/PendingEvaluations";
import React from "react";

interface AppRote {
  path: string;
  title: string;
  element: React.ReactNode;
  icon?: LucideIcon;
  roles: RoleType[];
  showInNav?: boolean;
}

export const APP_ROUTE: AppRote[] = [
  // -------- สำหรับ Assets Cente ------------
  {
    path: "borrow-return-assets_center",
    title: "ยืม-คืนครุภัณฑ์ (ศูนย์)",
    element: <AssetCenterBorrowReturn />,
    icon: Repeat,
    roles: [ROLES.ADMIN, ROLES.ASSET_CENTER_STAFF],
    showInNav: true,
  },
  {
    path: "asset-stock",
    title: "จัดการสต็อกครุภัณฑ์",
    element: <AssetStock />,
    icon: Archive,
    roles: [
      ROLES.ADMIN,
      ROLES.ASSET_CENTER_STAFF,
      ROLES.DEPARTMENT_STAFF,
      ROLES.MANAGER,
    ],
    showInNav: true,
  },
  {
    path: "part-stock",
    title: "จัดการสต็อกอะไหล่",
    element: <PartStock />,
    icon: Wrench,
    roles: [ROLES.ADMIN, ROLES.ASSET_CENTER_STAFF],
    showInNav: true,
  },
  {
    path: "help-desk",
    title: "แจ้งซ่อมครุภัณฑ์",
    element: <div>help-desk</div>,
    icon: Wrench,
    roles: [ROLES.ADMIN, ROLES.ASSET_CENTER_STAFF],
    showInNav: true,
  },
  {
    path: "track-status",
    title: "ติดตามสถานะ",
    element: <div>track-status</div>,
    icon: History,
    roles: [ROLES.ADMIN, ROLES.ASSET_CENTER_STAFF],
    showInNav: true,
  },
  {
    path: "borrow-history",
    title: "ประวัติการยืม",
    element: <div>borrow-history</div>,
    icon: History,
    roles: [ROLES.ADMIN, ROLES.ASSET_CENTER_STAFF],
    showInNav: true,
  },
  {
    path: "accept-work",
    title: "งานซ่อม",
    element: <PendingEvaluations />,
    icon: History,
    roles: [ROLES.ADMIN, ROLES.ASSET_CENTER_STAFF],
    showInNav: true,
  },
  // -------- สำหรับ Department ------------
];
