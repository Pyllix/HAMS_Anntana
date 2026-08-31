# TASK.md - HAMS Backend Status & Implementation Roadmap

## Overview
เอกสารนี้เป็นบันทึกสรุปสถานะการพัฒนาและการปรับปรุงระบบ HAMS อ้างอิงตาม Data Dictionary ใน `docs/hams_schema.dbml` และ **[CONTEXT.md](file:///f:/BUU/HAMS/HAMS_Anntana/backend/CONTEXT.md)**

---

## 1. งานปรับปรุงโครงสร้างฐานข้อมูล (Schema Alignment with `hams_schema.dbml`)

### Phase 1: Database Models & Prisma Schema Alignment (เสร็จสิ้น)
- [x] **1.1 Enum Updates (`prisma/schema/enum.prisma`)**:
  - [x] เพิ่ม `RiskLevel` enum (`HIGH` / สูง, `MEDIUM` / กลาง, `LOW` / ต่ำ, `UNSPECIFIED` / ไม่ระบุความเสี่ยง)
  - [x] เพิ่ม `PmType` enum (`IM` / Internal Maintenance, `EM` / External Maintenance)
  - [x] เพิ่ม `CalType` enum (`IC` / Internal Calibration, `EC` / External Calibration)
- [x] **1.2 Master / Lookup Models (`prisma/schema/`)**:
  - [x] สร้าง `AcqType` model (`acq_type_id`, `acq_type_name`, `is_active`, `description`) ใน `prisma/schema/acq-type.prisma`
  - [x] สร้าง `BudgetType` model (`budget_type_id`, `name`, `is_active`, `fiscal_year`, `description`) ใน `prisma/schema/budget-type.prisma`
  - [x] สร้าง `EquipmentType` model (`equipment_id`, `name`, `description`) ใน `prisma/schema/equipment-type.prisma`
  - [x] ตรวจสอบ `AssetStatus` (คง `WAIT_DISPOSAL` ไว้) และ `BorrowStatus` (เพิ่ม `PENDING_VERIFICATION`, `RETURNED_OPERATIONAL`, `RETURNED_DAMAGED`)
- [x] **1.3 Asset Model Alignment (`prisma/schema/asset.prisma`)**:
  - [x] เพิ่มฟิลด์: `noid`, `owner_id` (FK → `User`), `budget_type`, `acq_type`, `acq_doc`, `pm_type`, `pm_interval_month`, `cal_type`, `cal_interval_month`, `equipment_type` (FK → `EquipmentType`), `risk_level` (Enum), `is_special`, `is_backup`
  - [x] นำฟิลด์เก่าที่ไม่ตรงกับ DBML ออก: `gmdn`, `isMedicalDevice`, `disposalApprovedDate`
- [x] **1.4 Disposal Model Migration (`prisma/schema/asset-history.prisma` ➔ `prisma/schema/disposal.prisma`)**:
  - [x] ปรับตาราง `AssetDisposal` ให้เป็น `Disposal` (`disposal_id`, `disposal_doc_no`, `approved_date`, `asset_id`, `createdAt`, `updatedAt`, `deleteAt`) ตาม `hams_schema.dbml`
  - [x] ยกเลิกตาราง `AssetLost` (บันทึกสถานะสูญหายผ่าน `asset_status_id = LOST` บนตัว Asset โดยตรง)
- [x] **1.5 Transfer Model Creation (`prisma/schema/transfer.prisma`)**:
  - [x] สร้าง `Transfer` model (`id`, `asset_id`, `transfer_doc_no`, `transfer_date`, `from_section_id`, `to_section_id`, `from_location`, `to_location`, `requested_by`, `approved_by`, `received_by`, `transfer_status`, `remark`)
- [x] **1.6 Borrow Transaction Alignment (`prisma/schema/borrow.prisma`)**:
  - [x] ปรับชื่อฟิลด์ `reject_reason` ➔ `reject_remark` ใน `BorrowTransaction` ให้ตรงกับ DBML
- [x] **1.7 Database Migration & Seed (`prisma/seed.ts`)**:
  - [x] รัน `pnpm prisma db push` และ Generate Prisma Client
  - [x] อัปเดต `seed.ts` ให้ครอบคลุม Lookup data (`AcqType`, `BudgetType`, `EquipmentType`, Statuses ทั้งหมด) และข้อมูลจำลอง

### Phase 2: Service & DTO Layer Updates (เสร็จสิ้น)
- [x] **2.1 Asset DTO & Service**:
  - [x] ปรับปรุง Create/Update Asset DTO ให้รองรับฟิลด์ใหม่ทั้งหมด
  - [x] ปรับปรุง `AssetService` และ Controller ให้บันทึก/ดึงข้อมูลตาม Schema ใหม่
  - [x] ปรับปรุง API `POST /asset/:id/disposal` ให้สอดคล้องกับโมเดล `Disposal` ใหม่
- [x] **2.2 Asset Borrowing Service & DTOs**:
  - [x] ปรับปรุง DTOs และ Services ให้ใช้ `reject_remark`
  - [x] รองรับ Flow การยืม-คืน 8 สถานะหลัก (`PENDING_APPROVE`, `APPROVED`, `BORROWED`, `PENDING_RETURN`, `IN_PICKUP`, `RETURNED`, `REJECTED`, `CANCELLED`)
  - [x] เพิ่มระบบ Full Actor Audit Trail บันทึก `created_by_user_id`, `approved_by_user_id`, `handover_by_user_id`, `rejected_by_user_id`, `cancelled_by_user_id` อัตโนมัติจาก Login Session
  - [x] ปรับปรุงระบบการคืน 2 รูปแบบ (Staff Pickup with Job Claiming/IN_PICKUP vs. Walk-in Desk Return) พร้อมการตรวจสอบสิทธิ์แผนก `returnedByUserId` เข้มงวด
- [x] **2.3 Unit & E2E Tests Validation**:
  - [x] อัปเดต Mock Data และรัน Test Suite (`pnpm test` - 15/15 test suites, 75 tests passed)
- [x] **2.4 User & Password Management Update**:
  - [x] จัดทำ API `POST /auth/change-password` สำหรับผู้ใช้เปลี่ยนรหัสผ่านเอง โดยกำหนด `revokeOtherSessions: true` เป็นดีฟอลต์อัตโนมัติเพื่อความปลอดภัยของระบบ
  - [x] จัดทำ API `PATCH /users/:id/reset-password` สำหรับ ADMIN ในการรีเซ็ตรหัสผ่าน โดยส่งผ่าน `headers` ให้กับ Better-Auth Admin API และตัดการเชื่อมต่อโดยการลบทุก Active Session ในฐานข้อมูล
  - [x] ปรับแต่ง Better-Auth Config (`auth.ts`) และ Jest Mock ให้รองรับการตรวจสอบสิทธิ์แบบ Case-Sensitive ด้วย Case-Insensitive Roles Map (`ADMIN`, `DEPARTMENT_STAFF`, ฯลฯ)

---

## 2. แผนการพัฒนาโมดูลการจัดการอะไหล่และงานซ่อมบำรุง (Maintenance & Spare Parts Roadmap)

### Phase 3: Database & Prisma Schema Expansion (Maintenance & Spare Parts)
- [ ] **3.1 Enum Definitions (`prisma/schema/enum.prisma`)**:
  - [ ] เพิ่ม `ReportType` (`Repair`, `Maintenance`)
  - [ ] เพิ่ม `ActionType` (`REPAIR`, `FABRICATE`, `MODIFY`, `PREVENTIVE`)
  - [ ] เพิ่ม `UrgencyStatus` (`NORMAL`, `URGENT`, `EMERGENCY`)
  - [ ] เพิ่ม `StepActionType` (`INTERNAL_STOCK`, `EXTERNAL_STOCK`, `OUTSOURCE`, `PURCHASE_REPLACEMENT`, `SELF_REPAIR`)
- [ ] **3.2 Spare Parts Models (`prisma/schema/spare-part.prisma`)**:
  - [ ] สร้าง `SparepartGroup` model (`group_id`, `name`, `createdAt`, `updatedAt`, `deletedAt`)
  - [ ] สร้าง `Sparepart` model (`sparepart_id`, `sparepart_code`, `name`, `unit`, `price`, `min_stock`, `qty_in_stock`, `group_id`, `createdAt`, `updatedAt`, `deletedAt`)
  - [ ] สร้าง `SparepartAdd` model (`sparepart_add_id`, `sparepart_id`, `qty`, `total_price`, `sparepart_add_doc`, `add_by`, timestamps)
  - [ ] สร้าง `SparepartTxn` model (`txn_id`, `sparepart_id`, `job_id`, `txn_type`, `qty`, `unit_price`, `txn_date`, `txn_by`, `createdAt`)
- [ ] **3.3 Repair & Maintenance Models (`prisma/schema/repair.prisma`)**:
  - [ ] สร้าง `JobStatus` model (`job_status_id`, `status_code`, `status_name`, timestamps)
  - [ ] สร้าง `JobType` model (`job_type_id`, `name`, timestamps)
  - [ ] สร้าง `Cause` model (`cause_id`, `cause_code`, `cause_name`, timestamps)
  - [ ] สร้าง `TechCategory` model (`tech_category_id`, `category_code`, `category_name`, `is_active`, timestamps)
  - [ ] สร้าง `StepMaster` model (`step_master_id`, `step_number`, `action_type`, `label`)
  - [ ] สร้าง `RepairJob` model (ฟิลด์ทั้งหมดตาม DBML พร้อม Foreign Keys และ Audit fields)
  - [ ] สร้าง `RepairJobStep` model (`step_id`, `job_id`, `step_master_id`, `completeAt`)
  - [ ] สร้าง `MechanicRepair` model (`mechanic_repair_id`, `job_id`, `user_id`, timestamps)
- [ ] **3.4 Relations, Migration & Seed Expansion (`prisma/seed.ts`)**:
  - [ ] ผูก Relations ใน `Asset`, `User`, `Section`, `Company`
  - [ ] อัปเดต `seed.ts` ให้ครอบคลุม:
    - สถานะงานซ่อม (`PENDING`, `ASSIGNED`, `IN_PROGRESS`, `WAITING_PARTS`, `COMPLETED`, `CANCELLED`)
    - มูลเหตุปัญหา (`Cause`), หมวดช่าง (`TechCategory`), ประเภทงาน (`JobType`)
    - แม่แบบ 12 ขั้นตอนงานซ่อม (`StepMaster`) ครบทั้ง 5 ประเภทตาม `repair_step_flow.md`
    - กลุ่มอะไหล่ (`SparepartGroup`) และรายการอะไหล่ตัวอย่าง (`Sparepart`)
  - [ ] ดำเนินการ `pnpm prisma db push` และ generate client

---

### Phase 4: Spare Parts Management Module (`src/spare-parts/`) (เสร็จสิ้น)
- [x] **4.1 Spare Parts DTOs & Validation**:
  - [x] DTOs สำหรับ `SparepartGroup` (Create, Update, Query)
  - [x] DTOs สำหรับ `Sparepart` (Create, Update, Query, Filter Low Stock)
  - [x] DTOs สำหรับ `SparepartAdd` (Restock / Stock-in)
  - [x] DTOs สำหรับ `SparepartTxn` (Requisition History & Ledger Query)
- [x] **4.2 Spare Parts Service & Controller**:
  - [x] CRUD หมวดหมู่อะไหล่ (`/spare-part-groups`)
  - [x] CRUD รายการอะไหล่พร้อมคำนวณแจ้งเตือนสต็อกต่ำ (`/spare-parts`)
  - [x] API รับอะไหล่เข้าคลัง (`POST /spare-parts/stock-in`) ➔ ปรับยอด `qty_in_stock += qty`
  - [x] API ดึงประวัติการเบิก-จ่ายอะไหล่รายตัวและตามใบงานซ่อม (`/spare-parts/:id/history`, `/spare-parts/transactions`)
- [x] **4.3 Role Guards & Unit Tests**:
  - [x] ติดตั้ง `@Roles` ตาม Permission Matrix: `ASSET_CENTER_STAFF`, `PARCEL_STAFF`, `MAINTENANCE_STAFF`, `ADMIN`, `MANAGER`
  - [x] Unit Tests สำหรับการคำนวณและตัด/เพิ่มยอดสต็อก (20/20 Test Suites passed)

---

### Phase 5: Maintenance & Repair Core Module (`src/repairs/`)
- [ ] **5.1 Repair DTOs & Validation**:
  - [ ] DTO สำหรับการแจ้งซ่อมออนไลน์ (ผู้ใช้ทั่วไป)
  - [ ] DTO สำหรับการรับงาน วินิจฉัย และกำหนด Action Type (ช่าง)
  - [ ] DTO สำหรับการอัปเดตความคืบหน้าขั้นตอนย่อย (`completeAt`)
  - [ ] DTO สำหรับการเบิก/คืนอะไหล่ในงานซ่อม
  - [ ] DTO สำหรับการส่งมอบคืน บันทึกประกัน และปิดสรุปงาน
- [ ] **5.2 Repair Service & Controller**:
  - [ ] ระบบออกรหัสงานซ่อมอัตโนมัติ (`REP-YYYYMM-XXXX`)
  - [ ] API แจ้งซ่อม (`POST /repairs`) + ปรับสถานะ Asset เป็น `UNDER_REPAIR` / `UNAVAILABLE`
  - [ ] API ช่างรับงาน วินิจฉัย และ Clone 12 Steps อัตโนมัติจาก `StepMaster`
  - [ ] API มอบหมายช่าง (`POST /repairs/:id/mechanics`)
  - [ ] API อัปเดตสถานะขั้นตอนย่อย (`PATCH /repairs/:id/steps/:stepId`)
  - [ ] API บันทึกขั้นตอนแล้วเสร็จ (แจ้งเตือนผู้ส่งซ่อม)
  - [ ] API ส่งมอบคืน บันทึกวันประกัน ผู้รับมอบ และปิดงาน (`COMPLETED`) ➔ ปลดสถานะ Asset กลับเป็น `NORMAL` / `AVAILABLE`
- [ ] **5.3 Atomic Spare Part Transactions in Repairs**:
  - [ ] เชื่อมโยงการเบิกอะไหล่เข้าใบงานซ่อมผ่าน Prisma `$transaction`
  - [ ] ตรวจสอบสต็อก ป้องกันสต็อกติดลบ และ Snapshot `unit_price`

---

### Phase 6: Testing, Integration & Verification
- [ ] **6.1 Unit & Supertest E2E Tests**:
  - [ ] ทดสอบ Flow งานซ่อมครบทั้ง 5 ประเภท (`SELF_REPAIR`, `INTERNAL_STOCK`, `EXTERNAL_STOCK`, `OUTSOURCE`, `PURCHASE_REPLACEMENT`)
  - [ ] ทดสอบการตัดสต็อก คืนสต็อก และการ Snapshot ราคาอะไหล่
  - [ ] ทดสอบการเปลี่ยนสถานะควบคู่ของ Asset (UNDER_REPAIR ➔ NORMAL)
- [ ] **6.2 Scoping & Permission Verification**:
  - [ ] ตรวจสอบการแจ้งซ่อมและดูข้อมูลข้ามแผนก (`DEPARTMENT_STAFF` ดูได้เฉพาะแผนกตนเอง)
- [ ] **6.3 Documentation & Swagger**:
  - [ ] ตรวจสอบ Swagger API Annotations บนทุก Endpoint ให้สมบูรณ์

---

## 3. โมเดลและฟังก์ชันอื่นๆ ที่รอการพัฒนา (Remaining Deferred Modules)
- [ ] **Transfer Management Module**:
  - Module/Controller/Service สำหรับจัดการเอกสารการโอนย้ายครุภัณฑ์ (`Transfer`)


---

## 3. Checklist การตรวจสอบสิทธิ์แยกตาม Use Case (Permission Matrix Tracking)

| Use Case | ADMIN | MANAGER | ASSET_CENTER_STAFF | PARCEL_STAFF | MAINTENANCE_STAFF | DEPARTMENT_STAFF | Status |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **UC1: ยืม/คืน (Center)** | `[R]` | `[R]` | `[F]` | `[F]` | `[-]` | `[-]` | ✅ ติดตั้ง `@Roles` + `RolesGuard` (Supertest passed) |
| **UC2: ตรวจสอบครุภัณฑ์** | `[R]` | `[R]` | `[F]` | `[F]` | `[R]` | `[Own]` | ✅ พัฒนา API Filter Asset ตามแผนก (`GET /asset/my-section`, `GET /asset/section/:sectionId`, `GET /asset?section_id=...`) |
| **UC3: ส่งซ่อมครุภัณฑ์** | `[R]` | `[R]` | `[F]` | `[F]` | `[F]` | `[Own]` | ⏳ รอพัฒนา Repair Module |
| **UC4: สต็อกอะไหล่** | `[R]` | `[R]` | `[F]` | `[F]` | `[R]` | `[-]` | ⏳ รอพัฒนา Spare Parts Module |
| **UC5: สั่งซื้ออะไหล่** | `[R]` | `[Approve]` | `[Req]` | `[F]` | `[Req]` | `[-]` | ⏳ รอพัฒนา Purchase Module |
| **UC6: สต็อกครุภัณฑ์** | `[R]` | `[R]` | `[F]` | `[F]` | `[-]` | `[-]` | ⚠️ รอปรับฟิลด์ Asset ใหม่ |
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
