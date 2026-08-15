# TASK.md - HAMS Backend Status & RBAC Implementation Checklist

## Overview
เอกสารนี้เป็นบันทึกสรุปสถานะการพัฒนาระบบสิทธิ์และการเข้าถึงข้อมูล (Role-Based Access Control: RBAC) ของระบบ HAMS อ้างอิงตาม **Permission Matrix ใน [CONTEXT.md](file:///f:/BUU/HAMS/HAMS_Anntana/backend/CONTEXT.md)**

---

## 1. สถานะการกำหนด RBAC ปัจจุบัน (สิ่งที่ทำไปแล้ว)

- [x] **Prisma Schema Role Enum (`UserRole`)**:
  - กำหนด enum `UserRole` 6 บทบาทใน [enum.prisma](file:///f:/BUU/HAMS/HAMS_Anntana/backend/prisma/schema/enum.prisma):
    - `ADMIN`
    - `MANAGER`
    - `PARCEL_STAFF`
    - `ASSET_CENTER_STAFF`
    - `DEPARTMENT_STAFF`
    - `MAINTENANCE_STAFF`
- [x] **User Model Support**:
  - ฟิลด์ `role UserRole @default(DEPARTMENT_STAFF)` ใน [user.prisma](file:///f:/BUU/HAMS/HAMS_Anntana/backend/prisma/schema/user.prisma)
- [x] **Authentication Guard**:
  - ติดตั้งและนำ `@UseGuards(AuthGuard)` มาใช้ในทุก Controller หลักเพื่อยืนยันตัวตน (Authentication) ผ่าน `@thallesp/nestjs-better-auth`
- [x] **Inline Business Logic Role Checks (บางส่วน)**:
  - ใน [asset-borrow.service.ts](file:///f:/BUU/HAMS/HAMS_Anntana/backend/src/asset-borrow/asset-borrow.service.ts):
    - ตรวจสอบ `requestSource` (`SELF_SERVICE` vs `CENTER_SERVICE`) จาก `user.role`
    - ตรวจสอบสิทธิ์การยืมแทนผู้คืน (`received_by_user_id`) เฉพาะ `ASSET_CENTER_STAFF`

---

## 2. รายการสิ่งที่ยังขาดและต้องดำเนินการเพิ่ม (Gap Analysis & Todo)

### Phase 1: Core RBAC Infrastructure (ส่วนโครงสร้างสิทธิ์)
- [x] **1.1 Custom Decorator `@Roles(...)`**:
  - สร้าง `src/common/decorators/roles.decorator.ts` เพื่อใช้ระบุ Role ที่อนุญาตบน Endpoint/Controller
- [x] **1.2 Custom Guard `RolesGuard`**:
  - สร้าง `src/common/guards/roles.guard.ts` (Implement `CanActivate` อ่าน Metadata จาก `@Roles()` และตรวจสอบกับ `req.user.role`)
- [x] **1.3 Global หรือ Controller-Level Guard Binding**:
  - เปิดใช้งาน `RolesGuard` ควบคู่กับ `AuthGuard` globally ใน `AppModule`

### Phase 2: Endpoint Authorization Annotations (การผูกสิทธิ์บน Endpoints)
- [x] **2.1 UC11: UsersController (`src/users/users.controller.ts`)**:
  - เพิ่ม `@Roles(UserRole.ADMIN)` สำหรับการสร้าง/แก้ไข/ลบ/คืนค่าผู้ใช้งาน
- [x] **2.2 UC2 & UC6: AssetController (`src/asset/asset.controller.ts`)**:
  - ระบุสิทธิ์ `@Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)` บน Endpoints ที่สร้าง/แก้ไข/รายงานชำรุด/จำหน่าย
- [x] **2.3 UC1 & UC7: AssetBorrowController (`src/asset-borrow/asset-borrow.controller.ts`)**:
  - ระบุสิทธิ์ `@Roles(...)` บน endpoints `POST /borrowings`, `PATCH /borrowings/:id/return`, `PATCH /borrowings/:id/cancel`
- [x] **2.4 Setup & Lookup Controllers** (`asset-status`, `asset-type`, `availabilities`, `company`, `sections`):
  - ระบุสิทธิ์การแก้ไข/จัดการ master data เฉพาะ Admin (หรือ Parcel Staff / Asset Center Staff ตามสิทธิ์ของแต่ละ Master Data)
 
### Phase 3: Data-Level Ownership & Department Scoping (`[Own]`)
- [ ] **3.1 Department Scope Filter ใน Service Layer**:
  - ปรับปรุง `findAll` / `findOne` ใน `AssetService` และ `AssetBorrowService`
  - หาก `user.role === UserRole.DEPARTMENT_STAFF` ให้เพิ่มเงื่อนไข `where: { section_id: user.section_id }` โดยอัตโนมัติ

### Phase 4: RBAC สำหรับ Use Cases ที่รอการพัฒนา (Planned Modules)
- [ ] **UC4: จัดการสต็อกอะไหล่** (`[F]` ASSET_CENTER_STAFF, PARCEL_STAFF | `[R]` MAINTENANCE_STAFF)
- [ ] **UC5: สั่งซื้ออะไหล่** (`[F]` PARCEL_STAFF | `[Req]` ASSET_CENTER_STAFF, MAINTENANCE_STAFF | `[Approve]` MANAGER)
- [ ] **UC8: จัดการงานซ่อมบำรุง** (`[F]` MAINTENANCE_STAFF | `[R]` ASSET_CENTER_STAFF, PARCEL_STAFF)
- [ ] **UC9: อนุมัติรายจ่าย** (`[F]` MANAGER)
- [ ] **UC10: ดูรายงาน & Dashboard** (`[F]` MANAGER | `[R]` ASSET_CENTER_STAFF, PARCEL_STAFF | `[Own]` DEPARTMENT_STAFF)

---

## 3. Checklist การตรวจสอบสิทธิ์แยกตาม Use Case (Permission Matrix Tracking)

| Use Case | ADMIN | MANAGER | ASSET_CENTER_STAFF | PARCEL_STAFF | MAINTENANCE_STAFF | DEPARTMENT_STAFF | Status |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **UC1: ยืม/คืน (Center)** | `[R]` | `[R]` | `[F]` | `[F]` | `[-]` | `[-]` | ✅ ติดตั้ง `@Roles` + `RolesGuard` (Supertest passed) |
| **UC2: ตรวจสอบครุภัณฑ์** | `[R]` | `[R]` | `[F]` | `[F]` | `[R]` | `[Own]` | ⚠️ ขาด Department Filter [Own] |
| **UC3: ส่งซ่อมครุภัณฑ์** | `[R]` | `[R]` | `[F]` | `[F]` | `[F]` | `[Own]` | ⏳ รอพัฒนา Repair Module |
| **UC4: สต็อกอะไหล่** | `[R]` | `[R]` | `[F]` | `[F]` | `[R]` | `[-]` | ⏳ รอพัฒนา Spare Parts Module |
| **UC5: สั่งซื้ออะไหล่** | `[R]` | `[Approve]` | `[Req]` | `[F]` | `[Req]` | `[-]` | ⏳ รอพัฒนา Purchase Module |
| **UC6: สต็อกครุภัณฑ์** | `[R]` | `[R]` | `[F]` | `[F]` | `[-]` | `[-]` | ✅ ติดตั้ง `@Roles` + `RolesGuard` (Supertest passed) |
| **UC7: ยืม/คืน (Self)** | `[R]` | `[R]` | `[F]` | `[F]` | `[-]` | `[Own]` | ✅ ติดตั้ง `@Roles` + `RolesGuard` (Supertest passed) |
| **UC8: งานซ่อมบำรุง** | `[R]` | `[R]` | `[R]` | `[R]` | `[F]` | `[-]` | ⏳ รอพัฒนา Repair Module |
| **UC9: อนุมัติรายจ่าย** | `[R]` | `[F]` | `[-]` | `[-]` | `[-]` | `[-]` | ⏳ รอพัฒนา Approval Module |
| **UC10: ดูรายงาน** | `[R]` | `[F]` | `[R]` | `[R]` | `[-]` | `[Own]` | ⏳ รอพัฒนา Report Module |
| **UC11: จัดการผู้ใช้** | `[F]` | `[-]` | `[-]` | `[-]` | `[-]` | `[-]` | ✅ ติดตั้ง `@Roles(ADMIN)` บน Controller (Supertest passed) |
| **M1: บริษัทผู้ค้า (Company)** | `[F]` | `[R]` | `[R]` | `[F]` | `[R]` | `[R]` | ✅ ติดตั้ง `@Roles` + `RolesGuard` (Supertest passed) |
| **M2: หน่วยงาน (Sections)** | `[F]` | `[R]` | `[R]` | `[R]` | `[R]` | `[R]` | ✅ ติดตั้ง `@Roles(ADMIN)` บน CUD และเปิด Read ทุก Role |
| **M3: ประเภทครุภัณฑ์ (Asset Type)** | `[F]` | `[R]` | `[F]` | `[F]` | `[R]` | `[R]` | ✅ ติดตั้ง `@Roles` + `RolesGuard` (Supertest passed) |
| **M4: สถานะครุภัณฑ์ (Asset Status)** | `[F]` | `[R]` | `[R]` | `[R]` | `[R]` | `[R]` | ✅ ติดตั้ง `@Roles` + `RolesGuard` (Supertest passed) |
| **M5: ความพร้อมใช้งาน (Availabilities)** | `[F]` | `[R]` | `[R]` | `[R]` | `[R]` | `[R]` | ✅ ติดตั้ง `@Roles` + `RolesGuard` (Supertest passed) |
