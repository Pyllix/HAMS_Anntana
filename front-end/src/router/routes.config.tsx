import {
  Repeat,
  Archive,
  Wrench,
  History,
  ShoppingCart,
  LucideIcon,
  FilePlus2,
  Building2,
  Banknote,
  ClipboardCheck,
  TrendingUp,
} from "lucide-react";
import { ROLES, RoleType } from "../router/roles";
import AssetCenterBorrowReturn from "../pages/AssetCenterBorrowReturn";
import BorrowHistory from "../pages/BorrowHistort";
import DepartMentBorrowReturn from "../pages/DepartMentBorrowReturn";
import React from "react";
import AssetStock from "../pages/AssetStock";
import ConfirmRepair from "../pages/ConfirmRepair";
import RepairRequestPage from "../pages/RepairRequestPage";
import RepairHistory from "../pages/RepairHistory";
import PartStock from "../pages/PartStock";
import OrderSpareParts from "../pages/OrderSpareParts";
import AcquisitionTypePage from "../pages/AcquisitionTypePage";
import CompanySupplierPage from "../pages/CompanySupplierPage";
import BudgetTypePage from "../pages/BudgetTypePage";
import { ToolCase } from "lucide-react";
import TrackingAssetCenter from "../pages/TrackingAssetCenter";
import PendingEvaluations from "../pages/PendingEvaluations";
import UserManagement from "../pages/UserManagement";
import DepartmentManagement from "../pages/DepartmentManagement";
import EquipmentStock from "../pages/EquipmentStock";
import UnrepairableReceipts from "../pages/UnrepairableReceipts";
import SparePartApprovals from "../pages/SparePartApprovals";
import OutsourceApprovals from "../pages/OutsourceApprovals";
import ParcelRepairOperations from "../pages/ParcelRepairOperations";
import ExpenseForecast from "../pages/ExpenseForecast";

interface AppRote {
  path: string;
  title: string;
  element: React.ReactNode;
  icon?: LucideIcon;
  roles: RoleType[];
  showInNav?: boolean;
}

export const APP_ROUTE: AppRote[] = [
  // -------- สำหรับ แผนก/ผู้ใช้งานทั่วไป ------------
  {
    path: "borrow-request",
    title: "ยืมครุภัณฑ์",
    element: <DepartMentBorrowReturn />,
    icon: Repeat,
    roles: [ROLES.DEPARTMENT_STAFF, ROLES.PARCEL_STAFF],
    showInNav: true,
  },
  // -------- สำหรับ Assets Cente ------------
  {
    path: "borrow-return-assets_center",
    title: "ยืม-คืนครุภัณฑ์",
    element: <AssetCenterBorrowReturn />,
    icon: Repeat,
    roles: [ROLES.ASSET_CENTER_STAFF],
    showInNav: true,
  },
  {
    path: "borrow-history",
    title: "ประวัติการยืม",
    element: <BorrowHistory />,
    icon: History,
    roles: [ROLES.ASSET_CENTER_STAFF],
    showInNav: true,
  },
  {
    path: "asset-stock",
    title: "รายการสต็อกครุภัณฑ์",
    element: <AssetStock />,
    icon: Archive,
    roles: [
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
    roles: [ROLES.PARCEL_STAFF],
    showInNav: true,
  },
  {
    path: "equipment-stock",
    title: "จัดการสต็อกครุภัณฑ์",
    element: <EquipmentStock />,
    icon: Archive,
    roles: [ROLES.PARCEL_STAFF],
    showInNav: true,
  },
  {
    path: "parcel-equipment-stock",
    title: "จัดการสต็อกครุภัณฑ์",
    element: <EquipmentStock />,
    roles: [ROLES.PARCEL_STAFF],
    showInNav: false,
  },
  {
    path: "parcel-repair-operations",
    title: "อนุมัติงานซ่อม",
    element: <ParcelRepairOperations />,
    icon: ClipboardCheck,
    roles: [ROLES.PARCEL_STAFF],
    showInNav: true,
  },
  {
    path: "unrepairable-receipts",
    title: "อนุมัติรับคืนครุภัณฑ์",
    element: <UnrepairableReceipts />,
    icon: Wrench,
    roles: [ROLES.PARCEL_STAFF],
    showInNav: false,
  },
  {
    path: "spare-part-approvals",
    title: "อนุมัติการเบิกอะไหล่",
    element: <SparePartApprovals />,
    icon: ClipboardCheck,
    roles: [ROLES.PARCEL_STAFF],
    showInNav: false,
  },
  {
    path: "outsource-approvals",
    title: "อนุมัติส่งซ่อมภายนอก",
    element: <OutsourceApprovals />,
    roles: [ROLES.PARCEL_STAFF],
    showInNav: false,
  },
  {
    path: "order-spare-parts",
    title: "สั่งซื้ออะไหล่",
    element: <OrderSpareParts />,
    icon: ToolCase,
    roles: [ROLES.PARCEL_STAFF],
    showInNav: true,
  },
  {
    path: "acquisition-types",
    title: "วิธีการได้มา",
    element: <AcquisitionTypePage />,
    icon: FilePlus2,
    roles: [ROLES.PARCEL_STAFF],
    showInNav: true,
  },
  {
    path: "companies",
    title: "ผู้ผลิต/จำหน่าย",
    element: <CompanySupplierPage />,
    icon: Building2,
    roles: [ROLES.PARCEL_STAFF],
    showInNav: true,
  },
  {
    path: "budget-types",
    title: "ประเภทเงิน",
    element: <BudgetTypePage />,
    icon: Banknote,
    roles: [ROLES.PARCEL_STAFF],
    showInNav: true,
  },
  {
    path: "help-desk",
    title: "แจ้งซ่อมครุภัณฑ์",
    element: <RepairRequestPage />,
    icon: Wrench,
    roles: [
      ROLES.ASSET_CENTER_STAFF,
      ROLES.DEPARTMENT_STAFF,
      ROLES.MANAGER,
      ROLES.MAINTENANCE_STAFF,
      ROLES.PARCEL_STAFF,
    ],
    showInNav: true,
  },
  {
    path: "track-status",
    title: "ติดตามสถานะ",
    element: <TrackingAssetCenter />,
    icon: History,
    roles: [ROLES.ASSET_CENTER_STAFF],
    showInNav: true,
  },
  // -------- สำหรับ ช่าง ------------
  {
    path: "accept-work",
    title: "งานซ่อม",
    element: <PendingEvaluations />,
    icon: History,
    roles: [ROLES.MAINTENANCE_STAFF, ROLES.MAINTENANCE_HEAD],
    showInNav: true,
  },
  // -------- Admin ------------
  {
    path: "user-management",
    title: "จัดการผู้ใช้งาน",
    element: <UserManagement />,
    icon: History,
    roles: [ROLES.ADMIN],
    showInNav: true,
  },
  {
    path: "department-management",
    title: "จัดการแผนก",
    element: <DepartmentManagement />,
    icon: Building2,
    roles: [ROLES.ADMIN],
    showInNav: true,
  },
  // -------- ผู้จัดการ ------------
   {
    path: "expense-forecast",
    title: "พยากรณ์งบประมาณ (AI)",
    element: <ExpenseForecast />,
    icon: TrendingUp,
    roles: [
      ROLES.MANAGER,      
    ],
    showInNav: true,
  },
];
