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
- [x] **2.5 Asset Table & currentBorrowing Relation (`src/asset/asset.service.ts`)**:
  - แนบ `currentBorrowing` (ข้อมูลคำขอ/การยืมที่ active) ไปกับ `findAll` และ `findOne` ของ Asset เพื่อให้ตารางหน้าบ้านสามารถเปิด Dialog และกดยืนยันคืนได้ทันที
- [x] **2.6 Approval Workflow & Status Transition (`src/asset-borrow/`)**:
  - เพิ่มสถานะ `RESERVED` ใน `AvailabilityStatus` และ `PENDING_APPROVAL`, `REJECTED` ใน `BorrowStatus`
  - ปรับปรุง `createBorrow`: สำหรับ Self-Service ให้เป็น `PENDING_APPROVAL` + `RESERVED`
  - เพิ่ม Endpoint `PATCH /borrowings/:id/approve` และ `PATCH /borrowings/:id/reject` ควบคุมสิทธิ์ด้วย `@Roles(UserRole.ASSET_CENTER_STAFF)`
  - ปรับปรุง `cancelBorrow` และ `returnAsset` ให้คืน Availability สอดคล้องกับสถานะใหม่
- [x] **2.7 Borrow Security & Authorization Hardening (`src/asset-borrow/`)**:
  - ปรับปรุงสิทธิ์การกดคืน `returnAsset`: อนุญาตให้ผู้ยืมหรือเจ้าหน้าที่ที่อยู่ใน **แผนกเดียวกัน (`user.section_id === borrower.section_id`)** หรือเจ้าหน้าที่ศูนย์/ผู้ดูแลระบบ สามารถทำรายการคืนได้
  - ป้องกันการสวมรอยระบุ `dto.returnedByUserId` จากผู้ใช้ทั่วไป
  - ตรวจสอบความพร้อมทางกายภาพของครุภัณฑ์ `asset.asset_status === 'NORMAL'` ก่อนสร้างการยืม
  - ขอบเขตการมองเห็นรายการยืม-คืน `findAll` / `findOne` สำหรับ `DEPARTMENT_STAFF` ให้เห็นของแผนกตนเอง (`borrower.section_id`)
- [x] **2.8 Borrow Security Audit Hardening - Round 2 (`src/asset-borrow/`)**:
  - ปรับปรุง `cancelBorrow` ให้อนุญาตให้เจ้าหน้าที่ในแผนกเดียวกัน (`borrower.section_id === user.section_id`) กดยกเลิกคำขอแทนกันได้
  - ปรับปรุง Error Message ใน `returnAsset` และ `cancelBorrow` ให้แจ้งสถานะปัจจุบันของคำขออย่างชัดเจน (เช่น `'PENDING_APPROVAL'`, `'RETURNED'`)
  - เพิ่ม Helper `getCallerSectionId` พร้อม Fallback ดึง `section_id` จาก DB เพื่อการันตีความถูกต้องของข้อมูลแผนก แม้ Session เก่าจะไม่มี `section_id`
- [x] **2.9 Borrow Concurrency Protection & Business Rule Refinement (`src/asset-borrow/`)**:
  - ปรับปรุง `cancelBorrow`: จำกัดสิทธิ์ `DEPARTMENT_STAFF` / ผู้ยืม ให้กดยกเลิกคำขอได้เฉพาะสถานะ `PENDING_APPROVAL` เท่านั้น (หาก `BORROWED` ต้องคืนผ่าน `returnAsset`)
  - เพิ่ม Atomic Optimistic Locking (`updateMany` ร่วมกับสถานะคาดหวังใน `where`) ทั้งใน `createBorrow`, `approveBorrow`, `rejectBorrow`, `cancelBorrow`, และ `returnAsset` ป้องกันคำขอประมวลผลซ้ำซ้อน / Race Condition 100%
- [x] **2.10 Borrow State Workflow & Audit Timestamps (`src/asset-borrow/`)**:
  - เพิ่มสถานะ `APPROVED` ใน `BorrowStatus` (Seed + DB)
  - เพิ่มฟิลด์ `approved_at`, `handover_date`, `cancelled_at`, `rejected_at` และ `cancel_reason` ใน `BorrowTransaction`
  - ปรับ `approveBorrow` ให้เปลี่ยนสถานะเป็น `APPROVED` พร้อมบันทึก `approved_at` (Asset คงสถานะ `RESERVED`)
  - เพิ่ม Endpoint `PATCH /borrowings/:id/handover` สำหรับส่งมอบของจริง (เปลี่ยนเป็น `BORROWED` + บันทึก `handover_date` + เปลี่ยน Asset เป็น `BORROWED`)
  - ปรับ `rejectBorrow` ให้บันทึก `rejected_at`
  - ปรับ `cancelBorrow` ให้อัปเดต `cancelled_at` และ `cancel_reason` โดยอนุญาตให้เจ้าหน้าที่ศูนย์ฯ ยกเลิกคำขอสถานะ `APPROVED` ได้ (กรณี Approve ผิดพลาดแต่ยังไม่ได้ส่งมอบของจริง) และปิดการยกเลิกสถานะ `BORROWED` ทุก Role
 
### Phase 3: Data-Level Ownership & Department Scoping (`[Own]`)
- [ ] **3.1 Department Scope Filter ใน Service Layer**:
  - ปรับปรุง `findAll` / `findOne` ใน `AssetService` และ `AssetBorrowService`
  - หาก `user.role === UserRole.DEPARTMENT_STAFF` ให้เพิ่มเงื่อนไข `where: { section_id: user.section_id }` โดยอัตโนมัติ
- [ ] **3.2 User Lookup Endpoint สำหรับ Form/UI (`GET /users/lookup`)**:
  - สร้าง Endpoint พิเศษเฉพาะดึงรายชื่อพนักงานสำหรับใส่ Dropdown ผู้ยืม/ผู้รับผิดชอบ ในหน้า Frontend (เพื่อไม่ต้องปลด `@Roles(ADMIN)` ออกจาก `GET /users`)
- [ ] **3.3 Frontend RBAC Compatibility Audit**:
  - ตรวจสอบ API Responses และแนบ Error handling กรณีเกิด 403 Forbidden บนหน้า Frontend Forms

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
| **M3: ประเภทครุภัณฑ์ (Asset Type)** | `[F]` | `[R]` | `[R]` | `[F]` | `[R]` | `[R]` | ✅ ติดตั้ง `@Roles` + `RolesGuard` (Supertest passed) |
| **M4: สถานะครุภัณฑ์ (Asset Status)** | `[F]` | `[R]` | `[R]` | `[R]` | `[R]` | `[R]` | ✅ ติดตั้ง `@Roles` + `RolesGuard` (Supertest passed) |
| **M5: ความพร้อมใช้งาน (Availabilities)** | `[F]` | `[R]` | `[R]` | `[R]` | `[R]` | `[R]` | ✅ ติดตั้ง `@Roles` + `RolesGuard` (Supertest passed) |
