export const ROLES = {
  MAINTENANCE_HEAD: "MAINTENANCE_HEAD",
  MAINTENANCE_STAFF: "MAINTENANCE_STAFF",
  DEPARTMENT_STAFF: "DEPARTMENT_STAFF",
  ASSET_CENTER_STAFF: "ASSET_CENTER_STAFF",
  PARCEL_STAFF: "PARCEL_STAFF",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];

// ชื่อบทบาทภาษาไทยสำหรับแสดงผล
export const ROLE_LABELS: Record<RoleType, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  MANAGER: "ผู้จัดการ / หัวหน้างาน",
  MAINTENANCE_HEAD: "หัวหน้าช่างซ่อมบำรุง",
  MAINTENANCE_STAFF: "ช่างซ่อมบำรุง",
  ASSET_CENTER_STAFF: "เจ้าหน้าที่ศูนย์สินทรัพย์",
  PARCEL_STAFF: "เจ้าหน้าที่พัสดุ",
  DEPARTMENT_STAFF: "เจ้าหน้าที่ประจำแผนก",
};
