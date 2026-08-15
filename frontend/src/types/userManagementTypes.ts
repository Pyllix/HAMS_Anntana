/** ระดับสิทธิ์ผู้ใช้งาน – ตรงกับ role filter tabs ในหน้า mock-up */
export type SystemRole =
  | "admin"           // 1. ผู้ดูแลระบบ
  | "inventory_officer" // 2. เจ้าหน้าที่ครุภัณฑ์
  | "department_officer" // 3. เจ้าหน้าที่หน่วยงาน
  | "technician"      // 4. ช่าง/งานซ่อม
  | "manager"         // 5. ผู้บริหาร

export type AccountStatus = "active" | "suspended"

export interface ManagedUser {
  id: string
  empCode: string          // รหัสพนักงาน เช่น EMP-014
  name: string             // ชื่อ-นามสกุล
  email: string
  phone: string
  department: string       // หน่วยงาน / แผนก
  role: SystemRole
  status: AccountStatus
  createdAt: string        // วันที่เพิ่มเข้าระบบ
  lastLogin: string        // เข้าสู่ระบบล่าสุด
}

export interface CreateUserInput {
  name: string
  empCode: string
  email: string
  department: string
  role: SystemRole
  password: string
}

export interface UpdateUserInput {
  name?: string
  email?: string
  department?: string
  role?: SystemRole
  status?: AccountStatus
}

/** Label mapping สำหรับแสดงชื่อ role เป็นภาษาไทย */
export const ROLE_LABELS: Record<SystemRole, string> = {
  admin: "ผู้ดูแลระบบ",
  inventory_officer: "เจ้าหน้าที่ครุภัณฑ์",
  department_officer: "เจ้าหน้าที่หน่วยงาน",
  technician: "ช่าง/งานซ่อม",
  manager: "ผู้บริหาร",
}

/** Role description – แสดงใต้ dropdown เลือก role */
export const ROLE_DESCRIPTIONS: Record<SystemRole, string> = {
  admin: "สิทธิ์การใช้งาน: เข้าถึงและจัดการได้ทุกส่วนของระบบ",
  inventory_officer: "สิทธิ์การใช้งาน: เพิ่ม/แก้ไขข้อมูลครุภัณฑ์ จัดการยืม-คืน และบันทึกสถานะงานซ่อม",
  department_officer: "สิทธิ์การใช้งาน: ดูข้อมูลครุภัณฑ์ของหน่วยงาน และทำรายการยืม-คืน",
  technician: "สิทธิ์การใช้งาน: รับงานซ่อม อัปเดตสถานะ และบันทึกผลการซ่อม",
  manager: "สิทธิ์การใช้งาน: ดูรายงาน สถิติ และอนุมัติรายการ",
}

export const ROLES_LIST: SystemRole[] = [
  "admin",
  "inventory_officer",
  "department_officer",
  "technician",
  "manager",
]
