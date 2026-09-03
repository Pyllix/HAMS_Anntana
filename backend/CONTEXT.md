# CONTEXT.md

## Project Overview
The Hospital Asset & Maintenance System (HAMS) is a centralized web application designed to manage hospital assets and maintenance workflows. It serves as a single source of truth to minimize data redundancy, track assets in real-time, and streamline processes ranging from borrowing equipment to tracking spare parts and repairs.

## Business Domain
- **Asset (ครุภัณฑ์)**: Physical equipment or property owned by the hospital managed within the system. Asset records are **never deleted** — lifecycle changes are handled by updating `asset_status_id` to statuses such as Lost or Disposal.
- **AssetStatus (สถานะครุภัณฑ์)**: Lookup table driving all asset lifecycle states (e.g. Normal, Damaged, Under Repair, Disposal, Lost).
- **Disposal (การจำหน่ายครุภัณฑ์)**: Record capturing asset disposal documentation (`disposal_doc_no`, `approved_date`, `asset_id`).
- **Department (หน่วยงาน / แผนก)**: Internal hospital units or wards where assets are stationed or utilized.
- **Spare Part (อะไหล่)**: Inventory items and parts used specifically for the repair and maintenance of assets.
- **Maintenance Ticket / Repair Job (ใบแจ้งซ่อม / งานซ่อม)**: A documented request generated when an asset requires repair or scheduled maintenance.
- **Audit (การตรวจนับครุภัณฑ์)**: The process of verifying physical asset counts against system records.
- **User Roles**: Categorized accesses including Parcel Staff, Asset Center Staff, Department Staff, Maintenance Staff, Managers, and Admins.

---

## Role Permission Matrix (ตารางสิทธิ์การใช้งานระบบ)

> อ้างอิงจาก `docs/usecase-diagram.pdf` และ `docs/Usecase_Hams.md` (UC1 ถึง UC11)

### Permission Scopes (คำอธิบายระดับสิทธิ์)
- `[F]` **Full Access**: อ่าน เพิ่ม แก้ไข ลบ และดำเนินรายการทั้งหมดใน Use Case นั้นได้
- `[R]` **Read-Only**: เข้าถึงเพื่ออ่านหรือตรวจสอบข้อมูลได้อย่างเดียว
- `[Req]` **Requisition**: ตั้งเรื่องขอซื้อ/ขออนุมัติจัดหาพัสดุหรืออะไหล่
- `[Approve]` **Approve**: อนุมัติรายการหรืออนุมัติสั่งซื้อ
- `[Own]` **Own Scope**: อ่าน/ดำเนินรายการได้เฉพาะข้อมูลของตนเอง หรือแผนก/หน่วยงานของตนเองเท่านั้น
- `[-]` **No Access**: ไม่มีสิทธิ์เข้าถึงข้อมูลหรือฟังก์ชันใน Use Case นั้น

### Permission Matrix Table

| Use Case ID & Name | ADMIN | MANAGER | ASSET_CENTER_STAFF | PARCEL_STAFF | MAINTENANCE_STAFF | DEPARTMENT_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **UC1: จัดการยืม/คืนครุภัณฑ์ (Center-Service)** | `[R]` | `[R]` | `[F]` | `[F]` | `[-]` | `[-]` |
| **UC2: ตรวจสอบครุภัณฑ์** | `[R]` | `[R]` | `[F]` | `[F]` | `[R]` | `[Own]` |
| **UC3: ส่งซ่อมครุภัณฑ์** | `[R]` | `[R]` | `[F]` | `[F]` | `[F]` | `[Own]` |
| **UC4: จัดการสต็อกอะไหล่** | `[R]` | `[R]` | `[F]` | `[F]` | `[R]` | `[-]` |
| **UC5: สั่งซื้ออะไหล่** | `[R]` | `[Approve]` | `[Req]` | `[F]` | `[Req]` | `[-]` |
| **UC6: จัดการสต็อกครุภัณฑ์** | `[R]` | `[R]` | `[F]` | `[F]` | `[-]` | `[-]` |
| **UC7: ยืม/คืนครุภัณฑ์ (Self-Service)** | `[R]` | `[R]` | `[F]` | `[F]` | `[-]` | `[Own]` |
| **UC8: จัดการการซ่อม/บำรุงรักษา** | `[R]` | `[R]` | `[R]` | `[R]` | `[F]` | `[-]` |
| **UC9: อนุมัติรายจ่าย** | `[R]` | `[F]` | `[-]` | `[-]` | `[-]` | `[-]` |
| **UC10: ดูรายงาน & Dashboard** | `[R]` | `[F]` | `[R]` | `[R]` | `[-]` | `[Own]` |
| **UC11: จัดการผู้ใช้** | `[F]` | `[-]` | `[-]` | `[-]` | `[-]` | `[-]` |
| **M1: จัดการบริษัท/ผู้ขาย (Company)** | `[F]` | `[R]` | `[R]` | `[F]` | `[R]` | `[R]` |
| **M2: จัดการหน่วยงาน/แผนก (Sections)** | `[F]` | `[R]` | `[R]` | `[R]` | `[R]` | `[R]` |
| **M3: จัดการประเภทครุภัณฑ์ (Asset Type)** | `[F]` | `[R]` | `[R]` | `[F]` | `[R]` | `[R]` |
| **M4: จัดการสถานะครุภัณฑ์ (Asset Status)** | `[F]` | `[R]` | `[R]` | `[R]` | `[R]` | `[R]` |
| **M5: จัดการความพร้อมใช้งาน (Availabilities)** | `[F]` | `[R]` | `[R]` | `[R]` | `[R]` | `[R]` |


## Technology Stack
- TypeScript
- Node.js
- NestJS
- Jest & Supertest
- pnpm
- ESLint & Prettier

## Technical Decisions
| Concern | Decision | Status | Notes |
|---|---|---|---|
| Framework | NestJS | Confirmed | Configured in package.json |
| Language | TypeScript | Confirmed | Configured in package.json |
| ORM | Prisma | Confirmed | Known decision; pending codebase integration |
| Auth | BetterAuth | Confirmed | Integrated with uppercase roles configuration (ADMIN, etc.) and custom session/password management |

## High-Level Architecture
The system follows a standard Layered Architecture pattern specific to NestJS (Module -> Controller -> Service).
- **Controllers** handle HTTP routing and requests.
- **Services** house all business logic.
- **Data Access:** Services interact directly with the Prisma Client (ORMs) without an intermediate Repository layer to utilize Prisma's native type-safety and avoid boilerplate.

## Core Modules
- `app.module.ts`: Root module of the application.
- `main.ts`: Entry file and bootstrap for the application.

## Current Features
- Basic backend scaffolding with NestJS framework and e2e testing configuration.

## Planned Features
- **User & Access Control**: Role-based access control for multiple hospital staff types.
- **Asset Management**: Registration, continuous tracking, and status updates of hospital equipment.
- **Borrow & Return Management**: Processing of asset borrowing, duration calculation, and history tracking.
- **Spare Parts Requisition**: Inventory management handling automatic stock deductions.
- **Maintenance Management**: Tracking of repair tickets, repair operations, and assignment of tasks.
- **Asset Audit**: System comparison functionalities for physical asset counting.
- **Reports & Dashboard**: Generation of executive summaries and quantitative insights.

## System Goals & Constraints
- **Performance**: Must perform asset searches and data retrieval within an optimal timeframe (Real-time tracking).
- **Availability**: Must remain operational during all hospital working hours to support medical continuity.
- **Security**: Must strictly enforce access controls based on user roles (Admin, Staff, Manager, etc.).
- **Data Integrity**: Must heavily prevent data loss and reduce duplicate inputs across departments.

---

## Pagination Pattern

All list endpoints follow a unified pagination standard:

- **Query params**: `?page=1&limit=20&search=keyword`
- **Response envelope**:
  ```json
  {
    "data": [ ...items... ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```
- **Shared utilities** (under `src/common/`):
  - `dto/pagination.dto.ts` — validated query DTO with `page`, `limit`, `search`
  - `utils/paginate.util.ts` — `paginate(data, total, page, limit)` helper that builds the meta envelope
- **Prisma pattern**: use `$transaction([findMany, count])` to fetch data and total count in a single round-trip
- **Search**: applied as case-insensitive `contains` filter on relevant text fields (e.g. `name`, `code`, `building`)
- All future list endpoints across all features must follow this pattern.

---

## Asset Lifecycle Pattern & Status Transition Rules

Asset records use **status-based lifecycle management** — no soft delete.

- **No `deletedAt`** on the `Asset` model.
- Asset state changes are performed by updating `asset_status_id` (FK → `AssetStatus` table).
- เมื่อจำหน่ายครุภัณฑ์ จะสร้างระเบียนในตาราง `Disposal` พร้อมอัปเดต `asset_status_id` เป็น `DISPOSAL`
- เมื่อสูญหาย จะอัปเดต `asset_status_id` เป็น `LOST` โดยไม่มีการเก็บตารางประวัติสูญหายแยกต่างหาก

---

## Status Tables (Lookup Tables)

Lookup Tables ใน Database ที่ Seed ไว้ตั้งแต่ต้น โดยมี column ชื่อ `status_code` (VARCHAR 20) และ `status_name` (VARCHAR 50) เหมือนกันทุกตาราง

### AssetStatus (สถานะครุภัณฑ์ — สภาพของตัวครุภัณฑ์)

| status_code    | status_name        | ความหมาย                         |
|----------------|--------------------|----------------------------------|
| `NORMAL`       | ปกติ               | ครุภัณฑ์อยู่ในสภาพปกติ              |
| `DAMAGED`      | ชำรุด              | ครุภัณฑ์ชำรุด                      |
| `UNDER_REPAIR` | อยู่ระหว่างซ่อม    | กำลังอยู่ระหว่างการซ่อม              |
| `WAIT_DISPOSAL`| รอจำหน่าย         | อยู่ระหว่างรอจำหน่าย                |
| `DISPOSAL`     | จำหน่ายแล้ว        | จำหน่ายออกไปเรียบร้อยแล้ว           |
| `LOST`         | สูญหาย             | ครุภัณฑ์สูญหาย                     |

### AvailabilityStatus (สถานะพร้อมใช้งาน — บอกว่าว่างให้ยืมหรือไม่)

| status_code   | status_name      | ความหมาย                              |
|---------------|------------------|---------------------------------------|
| `AVAILABLE`   | ว่าง             | พร้อมให้ยืม                             |
| `RESERVED`    | ถูกจอง/รออนุมัติ  | มีการขอเบิก/ยืม รอการอนุมัติหรือส่งมอบ     |
| `BORROWED`    | ถูกยืม           | ถูกยืมและส่งมอบไปใช้งานอยู่               |
| `UNAVAILABLE` | ไม่พร้อมใช้งาน   | ไม่พร้อมให้ยืม (ซ่อม/จำหน่าย/สูญหาย)    |

### BorrowStatus (สถานะรายการยืม-คืน)

| status_code             | status_name        | ความหมาย                    |
|-------------------------|--------------------|-----------------------------|
| `PENDING_APPROVAL`      | รออนุมัติ           | ส่งคำขอยืม รอเจ้าหน้าที่ศูนย์อนุมัติ |
| `APPROVED`              | อนุมัติแล้ว         | เจ้าหน้าที่ศูนย์อนุมัติแล้ว รอส่งมอบของจริง |
| `BORROWED`              | กำลังยืม           | ส่งมอบครุภัณฑ์จริงแล้ว (อยู่ระหว่างใช้งาน) |
| `PENDING_VERIFICATION`  | รอตรวจสอบสภาพ       | ผู้ยืมส่งคืนแล้ว รอเจ้าหน้าที่ศูนย์ตรวจรับและยืนยันสภาพ |
| `RETURNED`              | คืนแล้ว            | ครุภัณฑ์ถูกส่งคืนเรียบร้อย (สถานะกลาง) |
| `RETURNED_OPERATIONAL`  | คืนแล้ว (สภาพปกติ)  | คืนเรียบร้อย สภาพใช้งานได้ปกติ |
| `RETURNED_DAMAGED`      | คืนแล้ว (ชำรุด)     | คืนเรียบร้อย สภาพชำรุด |
| `REJECTED`              | ปฏิเสธ             | คำขอยืมถูกปฏิเสธ             |
| `CANCELLED`             | ยกเลิก             | รายการยืมถูกยกเลิก             |

---

## Status Transition Rules

### AssetStatus Transitions

```
NORMAL        ──► DAMAGED / WAIT_DISPOSAL / DISPOSAL / LOST
DAMAGED       ──► UNDER_REPAIR / WAIT_DISPOSAL / DISPOSAL / LOST
UNDER_REPAIR  ──► NORMAL / WAIT_DISPOSAL / DISPOSAL / LOST
WAIT_DISPOSAL ──► DISPOSAL / NORMAL
DISPOSAL      ──► END       (Terminal)
LOST          ──► END       (Terminal)
```

> **Direct Status Editing**: การเปลี่ยนสถานะเป็น `WAIT_DISPOSAL`, `DISPOSAL`, `LOST` สามารถปรับแก้ได้โดยตรงผ่าน API แก้ไขสถานะของครุภัณฑ์ (`PATCH /assets/:id/status`) เพื่อให้สอดคล้องกับระบบหลักภายนอก
> **Terminal States**: `DISPOSAL` และ `LOST` ไม่สามารถเปลี่ยนกลับได้ ยกเว้น Admin ดำเนินการแก้ไขพร้อม Audit Log

### AvailabilityStatus Transitions

```
AVAILABLE   ──► RESERVED / BORROWED / UNAVAILABLE
RESERVED    ──► BORROWED / AVAILABLE
BORROWED    ──► AVAILABLE / UNAVAILABLE
UNAVAILABLE ──► AVAILABLE
```

---

## Business Rules (Status Coupling)

> อ้างอิงจาก `docs/status_role.md` และระเบียบการทำงานของโรงพยาบาล

| # | Event | AssetStatus | AvailabilityStatus | BorrowStatus | หมายเหตุ |
|---|-------|-------------|--------------------|--------------|---|
| 1 | **AssetStatus controls Availability** | — | เฉพาะ `NORMAL` เท่านั้นที่มี `AVAILABLE`, `RESERVED` หรือ `BORROWED` ได้ สถานะอื่น → `UNAVAILABLE` | — | กฎบังคับพื้นฐาน |
| 2 | **ยื่นขอยืม (Self-Service)** | ไม่เปลี่ยน | `AVAILABLE → RESERVED` | `→ PENDING_APPROVAL` | บันทึก `createdAt` |
| 3 | **อนุมัติการยืม (Approve)** | ไม่เปลี่ยน | คง `RESERVED` | `PENDING_APPROVAL → APPROVED` | บันทึก `approved_at` |
| 4 | **ส่งมอบของจริง (Handover/Dispatch)** | ไม่เปลี่ยน | `RESERVED → BORROWED` | `APPROVED → BORROWED` | บันทึก `handover_date` |
| 5 | **ยืมตรงที่ศูนย์ (Center-Service)** | ไม่เปลี่ยน | `AVAILABLE → BORROWED` | `→ BORROWED` | บันทึก `approved_at`, `handover_date` ทันที |
| 6 | **ปฏิเสธคำขอ (Reject)** | ไม่เปลี่ยน | `RESERVED → AVAILABLE` | `→ REJECTED` | บันทึก `reject_remark` |
| 7 | **ยกเลิกคำขอ (Cancel - Pending/Approved)** | ไม่เปลี่ยน | `RESERVED → AVAILABLE` | `→ CANCELLED` | เฉพาะก่อนส่งมอบของ |
| 8 | **ผู้ยืมส่งคืน (รอตรวจรับ)** | ไม่เปลี่ยน | คง `BORROWED` | `→ PENDING_VERIFICATION` | บันทึก `return_date`, รอศูนย์ตรวจรับ |
| 9 | **คืนปกติ (Return - Operational)** | ไม่เปลี่ยน | `BORROWED → AVAILABLE` | `→ RETURNED_OPERATIONAL` / `RETURNED` | บันทึก `return_date` |
| 10 | **คืนชำรุด (Return - Damaged)** | `NORMAL → DAMAGED` | `BORROWED → UNAVAILABLE` | `→ RETURNED_DAMAGED` | บันทึก `return_date` |
| 11 | **ส่งซ่อม (Send to Repair)** | `DAMAGED → UNDER_REPAIR` | คง `UNAVAILABLE` | — | |
| 12 | **ซ่อมเสร็จ (Repair Complete)** | `UNDER_REPAIR → NORMAL` | `UNAVAILABLE → AVAILABLE` | — | |
| 13 | **จำหน่าย (Disposal)** | `NORMAL/DAMAGED/UNDER_REPAIR → DISPOSAL` | `→ UNAVAILABLE` | — | สร้างบันทึกใน DISPOSAL (`disposal_doc_no`, `approved_date`) |
| 14 | **สูญหาย (Asset Lost)** | `NORMAL/DAMAGED/UNDER_REPAIR → LOST` | `→ UNAVAILABLE` | — | |

---

## Validation Rules

- Asset ที่ AssetStatus ≠ `NORMAL` **ห้าม**มี AvailabilityStatus = `AVAILABLE` หรือ `BORROWED`
- Asset ที่ AssetStatus = `DISPOSAL` หรือ `LOST` **ไม่สามารถสร้างรายการยืมใหม่ได้**
- การยืมสามารถเกิดขึ้นได้เฉพาะเมื่อ AssetStatus = `NORMAL` **และ** AvailabilityStatus = `AVAILABLE` เท่านั้น

---

## Disposal Entity (การจำหน่ายครุภัณฑ์)

โครงสร้างตาราง `DISPOSAL` อ้างอิงตาม `hams_schema.dbml`:

| Column | Type | Required | FK | Description |
|---|---|---|---|---|
| `disposal_id` | UUID | ✅ PK | | ID ประจำรายการจำหน่าย |
| `disposal_doc_no` | VARCHAR(255) | ✅ | | หมายเลขเอกสารการจำหน่าย |
| `approved_date` | TIMESTAMPTZ | ✅ | | วันที่อนุมัติจำหน่าย |
| `asset_id` | UUID | ✅ | ASSET | ครุภัณฑ์ที่จำหน่าย |
| `createdAt` | TIMESTAMPTZ | ✅ | | วันเวลาที่บันทึก |
| `updatedAt` | TIMESTAMPTZ | ✅ | | วันเวลาที่แก้ไขล่าสุด |
| `deleteAt` | TIMESTAMPTZ | | | Soft delete |

```
POST  /asset/:id/disposal        → create Disposal (disposal_doc_no, approved_date) + อัปเดต AssetStatus → DISPOSAL
```

---

## Borrow & Return Flow (การยืม-คืนครุภัณฑ์)

> อ้างอิงจาก Activity Diagram "การยืม-คืน", UC1, UC7, SRS FN-BOR-01 ถึง FN-BOR-06 และ Data Dictionary

### Actors

| Actor | บทบาท |
|---|---|
| **PARCEL_STAFF / DEPARTMENT_STAFF** | ยืมครุภัณฑ์ผ่านแอปด้วยตนเอง (Self-Service), คืนครุภัณฑ์ |
| **ASSET_CENTER_STAFF** | ทำเรื่องยืมให้ผู้อื่น (Center-Service), รับคืน, อัปเดตสถานะครุภัณฑ์ |

### รูปแบบการยืม (Borrow Modes)

| Mode | ผู้ดำเนินการ | request_source | หมายเหตุ |
|---|---|---|---|
| **ยืมผ่านแอป** (Self-Service) | PARCEL_STAFF, DEPARTMENT_STAFF | `SELF_SERVICE` | `borrower_id` = `user.id` ของผู้กดเสมอ — ห้าม override |
| **เจ้าหน้าที่ศูนย์ทำให้** (Center-Service) | ASSET_CENTER_STAFF | `CENTER_SERVICE` | ต้องระบุ `borrowerId` ของผู้ยืมจริงใน Request Body |

### รูปแบบการรับครุภัณฑ์ (Delivery Method)

| Mode | delivery_method | รายละเอียด |
|---|---|---|
| **มารับด้วยตนเอง** | `PICKUP` | ผู้ยืมไปรับที่ศูนย์ครุภัณฑ์ |
| **ให้เจ้าหน้าที่นำส่ง** | `DELIVERY` | เจ้าหน้าที่ศูนย์นำไปส่งที่แผนก |

### รูปแบบการคืน (Return Modes)

| Mode | return_method | returned_by_user_id | received_by_user_id |
|---|---|---|---|
| **นำไปคืนเอง / ให้มารับ** (ผู้ยืมกดคืน) | `self_return` / `staff_pickup` | `user.id` ของผู้กดคืน | `null` |
| **รับคืน** (ASSET_CENTER_STAFF กดรับ) | `self_return` / `staff_pickup` | `dto.returnedByUserId` หรือ `borrower_id` | `user.id` ของ AC Staff |

> **กฎ**: `received_by_user_id` จะมีค่าก็ต่อเมื่อ **ASSET_CENTER_STAFF** เป็นคนกดรับคืนเท่านั้น

---

### Security & Permission Scoping Rules (กฎความปลอดภัยและการควบคุมสิทธิ์)

1. **การคืนครุภัณฑ์ (`returnAsset`)**:
   - อนุญาตเฉพาะ: ผู้ยืมคนนั้นเอง (`borrower_id`), เจ้าหน้าที่ศูนย์หรือผู้ดูแลระบบ (`ASSET_CENTER_STAFF`, `ADMIN`, `MANAGER`), หรือ **เจ้าหน้าที่ที่อยู่แผนกเดียวกัน** (`user.section_id === borrower.section_id`)
2. **การยกเลิกรายการยืม (`cancelBorrow`)**:
   - **`DEPARTMENT_STAFF` / ผู้ยืม / เพื่อนร่วมแผนก**: สามารถกดยกเลิกคำขอได้เฉพาะตอนที่สถานะยังเป็น **`PENDING_APPROVAL` (รออนุมัติ)** เท่านั้น
   - **`ASSET_CENTER_STAFF` / `ADMIN` / `MANAGER`**: สามารถกดยกเลิกคำขอได้ในสถานะ **`PENDING_APPROVAL`** และ **`APPROVED`** (กรณีอนุมัติผิดพลาด แต่ยังไม่ได้ส่งมอบของจริง)
   - **ทุก Role ไม่สามารถกดยกเลิกสถานะ `BORROWED` ได้**: หากส่งมอบของจริงไปแล้ว จะต้องทำรายการคืน (`returnAsset`) เท่านั้น เพื่อให้มีการตรวจรับสภาพครุภัณฑ์และบันทึกประวัติการส่งคืน
3. **การป้องกัน Concurrency & Race Condition (Optimistic Locking)**:
   - การเปลี่ยนสถานะของ `BorrowTransaction` และ `Asset` ทั้งหมด (`createBorrow`, `approveBorrow`, `handoverAsset`, `rejectBorrow`, `cancelBorrow`, `returnAsset`) จะต้องใช้ Atomic Optimistic Locking (`updateMany` กับเงื่อนไขสถานะคาดหวังใน `where`) เพื่อป้องกันคำขอทำงานพร้อมกันชนกัน และจะโยน `409 ConflictException` เมื่อพบการประมวลผลซ้อน
4. **การตรวจสอบสิทธิ์ความปลอดภัยในแผนก (DB Fallback Verification)**:
   - ตรวจสอบ `section_id` ของผู้เรียกผ่าน Helper `getCallerSectionId`: ระบบจะอ่าน `user.section_id` จาก Session ก่อน หากไม่มี (เช่น Session เก่า) จะทำการตรวจสอบข้อมูลในฐานข้อมูล (`users.section_id`) แบบเรียลไทม์เพื่อป้องกันช่องโหว่การสวมสิทธิ์ข้ามแผนก
5. **ข้อกำหนดสถานะสำหรับ Error Reporting**:
   - การกระทำต่างๆ จะต้องตรวจสอบความเข้ากันได้ของสถานะ Transaction เสมอ และส่ง Error status code และชื่อสถานะ (เช่น `PENDING_APPROVAL`, `APPROVED`, `RETURNED`) กลับไปที่ Frontend อย่างชัดเจนหากไม่เป็นไปตามขั้นตอนที่ถูกต้อง

---

### Flow 1A: ยืมผ่านแอป (Self-Service Borrow)

```
[เจ้าหน้าที่หน่วยงาน]                                [เจ้าหน้าที่ศูนย์ครุภัณฑ์]
  │                                                       │
  ● Start                                                 │
  │                                                       │
  ├─ เลือกเมนู "ยืม-คืนครุภัณฑ์"                            │
  │                                                       │
  ├─ ระบบแสดงรายการครุภัณฑ์                                  │
  │  (รูปภาพ, ชื่อ/รหัส, ประเภท, สถานะ,                      │
  │   ผู้ยืม/แผนก, วันที่ยืม, currentBorrowing)              │
  │                                                       │
  ├─ กดปุ่ม "ยืมของ"                                       │
  │  (เฉพาะครุภัณฑ์สถานะ "ว่าง / AVAILABLE")                  │
  │                                                       │
  ├─ ระบบแสดง Dialog "ทำรายการยืมครุภัณฑ์"                    │
  │                                                       │
  ├─ กรอกข้อมูลการยืม:                                      │
  │  • วิธีรับครุภัณฑ์ (บังคับ):                                │
  │    ◇──[มารับด้วยตนเอง: PICKUP]                           │
  │    └──[ให้เจ้าหน้าที่นำไปส่ง: DELIVERY]                    │
  │                                                       │
  ├─ กดปุ่ม "ยืนยันการขอยืม"                                 │
  │  (สร้าง Transaction: PENDING_APPROVAL                   │
  │   Asset Availability: AVAILABLE → RESERVED              │
  │   Timestamp: createdAt)                                │
  │                                            ┌──────────┤
  │                                 ตรวจสอบคำขอ & จัดเตรียมของ │
  │                                           ◇           │
  │                              ปฏิเสธ ◄───╱   ╲───► อนุมัติ│
  │                                 │      ╲   ╱      │   │
  │                                 ▼       ╲ ╱       ▼   │
  │                         REJECTED        │      APPROVED
  │                   Asset: AVAILABLE ◄────┘   (Asset: RESERVED,
  │                                              approved_at)
  │                                                       │
  │                                             ส่งมอบของจริง (Handover)
  │                                                       ▼
  │                                                    BORROWED
  │                                              (Asset: BORROWED,
  │                                               handover_date)
  │                                                       │
  ◄───────────────────────────────────────────────────────┘
  ● End                                                   │
```

### Flow 1B: เจ้าหน้าที่ศูนย์ทำเรื่องยืมให้ (Center-Service Borrow)

```
[เจ้าหน้าที่หน่วยงาน]                                [เจ้าหน้าที่ศูนย์ครุภัณฑ์]
  │                                                       │
  │                                                  ● Start
  │                                                       │
  │                                   กดปุ่ม "ทำรายการยืมแทน"
  │                                                       │
  │                                   กรอกข้อมูลการยืม:     │
  │                                   • ครุภัณฑ์ที่ต้องการยืม  │
  │                                   • ผู้ยืม (เลือก user)   │
  │                                   • วิธีรับครุภัณฑ์       │
  │                                                       │
  │                                   ตรวจสอบสถานะ          │
  │                                   + สร้างรายการยืม (BORROWED)
  │                                   + AvailabilityStatus  │
  │                                     AVAILABLE→BORROWED  │
  │                                   + approved_at, handover_date
  │                                                       │
  │  ◄──── ระบบแจ้งเตือนผู้ยืม ────────┘                     │
```

### Flow 2: การคืนครุภัณฑ์ (Return Flow)

```
[ผู้ยืม / เจ้าหน้าที่หน่วยงาน]                        [เจ้าหน้าที่ศูนย์ครุภัณฑ์]
  │                                                       │
  ├─◇ วิธีการคืน?                                          │
  │  │                                                    │
  │  ├─[นำไปคืนเอง: self_return]                            │
  │  │   ├─ นำครุภัณฑ์ไปที่ศูนย์ ──────────────────────────────┤
  │  │                                                    │
  │  ├─[ให้เจ้าหน้าที่มารับคืน: staff_pickup]                  │
  │  │   ├─ กดปุ่ม "ขอให้มารับคืน" ────────────────────────────┤
  │  │   │                                 เจ้าหน้าที่ไปรับ   │
  │  │   │                                 ครุภัณฑ์ที่แผนก    │
  │  │                                                    │
  │  └───────────────────────────────────────► ทำรายการรับคืน │
  │                                                       │
  │                                   ระบุข้อมูลการคืน:       │
  │                                   • return_condition   │
  │                                   • return_method      │
  │                                   • return_remark      │
  │                                                       │
  │                                   กดปุ่ม "ยืนยันรับคืน"    │
  │                                          │             │
  │                                         ◇             │
  │                                        ╱ ╲            │
  │                            Damage ◄──╱   ╲──► Normal  │
  │                               │    ╲   ╱      │      │
  │                               ▼     ╲ ╱       ▼      │
  │                    AssetStatus:           AvailabilityStatus:
  │                    NORMAL→DAMAGED         BORROWED→AVAILABLE
  │                    AvailabilityStatus:
  │                    BORROWED→UNAVAILABLE
  │                               │             │         │
  │                               └──────┬──────┘         │
  │                                      ▼                │
  │                              อัปเดตสถานะครุภัณฑ์        │
  │                              (บันทึก return_date)     │
  ◄──────────────────────────────────────┘                │
  ● End                                                   │
```

---

## Data Model: ASSET (ครุภัณฑ์)

| Column | Type | Required | FK | Description |
|---|---|---|---|---|
| `asset_id` | UUID | ✅ PK | | ID ของครุภัณฑ์ |
| `noid` | VARCHAR(30) | | | หมายเลขครุภัณฑ์ |
| `name` | VARCHAR(100) | ✅ | | ชื่อครุภัณฑ์ |
| `model` | VARCHAR(100) | ✅ | | รุ่นของครุภัณฑ์ |
| `serial_no` | VARCHAR(30) | | | เลขประจำเครื่อง |
| `budget_type` | VARCHAR(100) | ✅ | | ประเภทเงินทุน (เช่น เงินบริจาค เงินกู้ เงินงบประมาณ) |
| `acq_type` | VARCHAR(100) | ✅ | | ประเภทการได้รับมา (เช่น ติดมากับตึก รับโอน บริจาค) |
| `type_id` | INT | ✅ | ASSET_TYPE | ประเภทของครุภัณฑ์ |
| `section_id` | UUID | ✅ | SECTION | แผนก/หน่วยงานที่รับผิดชอบ |
| `company_id` | UUID | ✅ | COMPANY | บริษัทคู่ค้า/ผู้ขาย |
| `asset_status_id` | INT | ✅ | ASSET_STATUS | สถานะครุภัณฑ์ |
| `availability_status_id` | INT | | AVAILABILITY_STATUS | สถานะความพร้อมใช้งาน |
| `receive_date` | TIMESTAMPTZ | ✅ | | วันที่นำครุภัณฑ์เข้าคลัง |
| `price` | NUMERIC(15,2) | ✅ | | ราคาครุภัณฑ์ |
| `acq_doc` | TEXT | ✅ | | เอกสารการได้รับมา |
| `warranty_date` | VARCHAR(30) | | | วันที่หมดประกัน |
| `owner_id` | UUID | ✅ | USER | ผู้รับผิดชอบครุภัณฑ์ |
| `pm_type` | ENUM | ✅ | | ประเภทการบำรุงรักษา (`IM`, `EM`) |
| `pm_interval_month` | INT | | | ความถี่การบำรุงรักษา (เดือน) |
| `cal_type` | ENUM | ✅ | | ประเภทการสอบเทียบมาตรฐาน (`IC`, `EC`) |
| `cal_interval_month` | INT | | | ความถี่การสอบเทียบมาตรฐาน (เดือน) |
| `equipment_type` | INT | | EQUIPMENT_TYPE | ประเภทเครื่องมือ |
| `risk_level` | ENUM | ✅ | | ระดับความเสี่ยง (`HIGH`, `MEDIUM`, `LOW`, `UNSPECIFIED`) |
| `is_special` | BOOLEAN | ✅ | | เป็นเครื่องมือพิเศษหรือไม่ |
| `is_backup` | BOOLEAN | ✅ | | เป็นเครื่องมือสำรองหรือไม่ |
| `remark` | TEXT | | | หมายเหตุ |
| `image_url` | TEXT | ✅ | | URL รูปภาพครุภัณฑ์ |
| `createdAt` | TIMESTAMPTZ | ✅ | | วันเวลาที่สร้าง |
| `created_by` | UUID | ✅ | USER | ผู้สร้างข้อมูล |
| `updatedAt` | TIMESTAMPTZ | ✅ | | วันเวลาที่แก้ไขล่าสุด |
| `updated_by` | UUID | ✅ | USER | ผู้แก้ไขล่าสุด |

---

## Data Model: TRANSFER (การโอนย้ายครุภัณฑ์)

| Column | Type | Required | FK | Description |
|---|---|---|---|---|
| `id` | UUID | ✅ PK | | ID การโอนย้าย |
| `asset_id` | UUID | ✅ | ASSET | ครุภัณฑ์ที่ถูกโอนย้าย |
| `transfer_doc_no` | VARCHAR(255) | ✅ | | หมายเลขเอกสารการโอนย้าย |
| `transfer_date` | TIMESTAMPTZ | ✅ | | วันที่โอนย้าย |
| `from_section_id` | UUID | | SECTION | แผนกต้นทาง |
| `to_section_id` | UUID | | SECTION | แผนกปลายทาง |
| `from_location` | VARCHAR(255) | | | สถานที่ต้นทาง |
| `to_location` | VARCHAR(255) | | | สถานที่ปลายทาง |
| `requested_by` | UUID | ✅ | USER | ผู้ที่ร้องขอการโอนย้าย |
| `approved_by` | UUID | ✅ | USER | ผู้ที่อนุมัติการโอนย้าย |
| `received_by` | UUID | ✅ | USER | ผู้รับมอบการโอนย้าย |
| `transfer_status` | VARCHAR(100) | ✅ | | สถานะการโอนย้าย |
| `remark` | TEXT | | | หมายเหตุ |
| `createdAt` | TIMESTAMPTZ | ✅ | | วันเวลาที่สร้าง |
| `updatedAt` | TIMESTAMPTZ | ✅ | | วันเวลาที่แก้ไขล่าสุด |
| `deletedAt` | TIMESTAMPTZ | | | Soft delete |

---

## Data Model: Master / Lookup Tables

### ACQ_TYPE (ประเภทการได้รับมา)
- `acq_type_id` (INT PK), `acq_type_name` (VARCHAR 100), `is_active` (BOOLEAN), `description` (TEXT), `createdAt`, `updatedAt`, `deletedAt`

### BUDGET_TYPE (ประเภทเงินทุน)
- `budget_type_id` (INT PK), `name` (VARCHAR 255), `is_active` (BOOLEAN), `fiscal_year` (INT), `description` (TEXT), `createdAt`, `updatedAt`, `deleteAt`

### EQUIPMENT_TYPE (ประเภทเครื่องมือ)
- `equipment_id` (INT PK), `name` (VARCHAR 100), `description` (TEXT), `createdAt`, `updatedAt`

---

## Data Model: BORROW_TRANSACTION

| Column | Type | Required | FK | Description |
|---|---|---|---|---|
| `borrow_transaction_id` | UUID | ✅ PK | | ID ของรายการยืม-คืน |
| `asset_id` | UUID | ✅ | ASSET | ครุภัณฑ์ที่ยืม |
| `borrower_id` | UUID | ✅ | USER | ผู้ยืม |
| `returned_by_user_id` | UUID | | USER | ผู้คืน (อาจไม่ใช่ผู้ยืม) |
| `received_by_user_id` | UUID | | USER | เจ้าหน้าที่ผู้รับคืน (เฉพาะ AC Staff) |
| `borrow_status_id` | INTEGER | ✅ | BORROW_STATUS | สถานะรายการยืม-คืน |
| `request_source` | ENUM | ✅ | | `SELF_SERVICE` / `CENTER_SERVICE` |
| `delivery_method` | ENUM | ✅ | | `PICKUP` / `DELIVERY` |
| `createdAt` | TIMESTAMPTZ | ✅ | | วันเวลาที่สร้างรายการ (= วันที่ยื่นคำขอ) |
| `approved_at` | TIMESTAMPTZ | | | วันเวลาที่เจ้าหน้าที่กดอนุมัติคำขอ |
| `handover_date` | TIMESTAMPTZ | | | วันเวลาที่ส่งมอบครุภัณฑ์จริง (เริ่มยืมจริง) |
| `return_date` | TIMESTAMPTZ | | | วันเวลาที่คืน |
| `cancelled_at` | TIMESTAMPTZ | | | วันเวลาที่คำขอถูกยกเลิก |
| `rejected_at` | TIMESTAMPTZ | | | วันเวลาที่คำขอถูกปฏิเสธ |
| `cancel_reason` | TEXT | | | เหตุผลการยกเลิกรายการ |
| `return_condition` | ENUM | | | สภาพเครื่องตอนคืน: `Normal` / `Damage` |
| `return_method` | ENUM | | | วิธีการคืน: `self_return` / `staff_pickup` |
| `return_remark` | TEXT | | | หมายเหตุการคืน |
| `reject_remark` | TEXT | | | หมายเหตุการไม่อนุมัติการยืม (เฉพาะกรณี REJECTED) |

## Data Model: BORROW_STATUS (Lookup Table)

| Column | Type | Required | Description |
|---|---|---|---|
| `borrow_status_id` | INTEGER | ✅ PK | ID ของสถานะ |
| `status_code` | VARCHAR(20) | ✅ | รหัสสถานะ (eng) |
| `status_name` | VARCHAR(50) | ✅ | ชื่อสถานะ (thai) |
| `createdAt` | TIMESTAMPTZ | ✅ | |
| `updatedAt` | TIMESTAMPTZ | ✅ | |
| `deletedAt` | TIMESTAMPTZ | | Soft delete |

---

## Spare Parts Management (ระบบการจัดการอะไหล่)

> อ้างอิงจาก `docs/hams_schema.dbml`, UC4 (จัดการสต็อกอะไหล่), และ UC5 (สั่งซื้ออะไหล่)

### สรุปหน้าที่และความสัมพันธ์ของตารางอะไหล่

1. **`SPAREPART` (รายการอะไหล่ในคลัง)**:
   - บันทึกข้อมูล Master ของอะไหล่แต่ละชนิด: รหัสอะไหล่ (`sparepart_code`), ชื่ออะไหล่ (`name`), หน่วยนับ (`unit`), ราคาต่อหน่วย (`price`), จำนวนขั้นต่ำเตือนสั่งซื้อ (`min_stock`), และจำนวนคงเหลือในคลัง (`qty_in_stock`)
   - ผูกกับกลุ่มอะไหล่ `SPAREPART_GROUP`
   - เมื่อสร้างรายการอะไหล่ครั้งแรก สามารถเริ่มต้น `qty_in_stock = 0` หรือหากระบุจำนวนเริ่มต้น ระบบจะสร้างประวัติใน `SPAREPART_ADD` ให้เบื้องหลัง
2. **`SPAREPART_ADD` (ใบสั่งซื้อ/รับเข้าอะไหล่)**:
   - ใช้เฉพาะกรณีบันทึกการรับเข้า/สั่งซื้ออะไหล่เพิ่มเข้าคลัง (`SPAREPART.qty_in_stock += qty`)
   - เก็บเลขอ้างอิงเอกสารหรือใบเสร็จ (`sparepart_add_doc`), จำนวนที่เพิ่ม (`qty`), ราคารวม (`total_price`), และผู้บันทึก (`add_by`)
3. **`SPAREPART_TXN` (สมุดบันทึกการใช้อะไหล่เฉพาะในงานซ่อม)**:
   - ผูกกับใบงานซ่อม (`job_id`) เสมอเพื่อบันทึกประวัติการเบิก-คืนอะไหล่ของแต่ละงานซ่อม
   - ประเภทรายการ (`txn_type`):
     - `WITHDRAW`: เบิกอะไหล่ออกไปใช้ในงานซ่อม ➔ ตรวจสอบสต็อก `qty_in_stock >= qty` และตัดสต็อก `qty_in_stock -= qty`
     - `RETURN`: คืนอะไหล่ที่เบิกเกินหรือไม่ใช้งานกลับเข้าคลัง ➔ คืนสต็อก `qty_in_stock += qty`
   - บันทึกราคา Snapshot `unit_price` จาก `SPAREPART.price` ณ เวลาที่เบิก เพื่อคำนวณต้นทุนค่าซ่อมที่แท้จริง

---

## Maintenance & Repair Flow (ระบบการแจ้งซ่อมและบำรุงรักษา)

> อ้างอิงจาก `docs/hams_schema.dbml`, `docs/repair_step_flow.md`, UC3 (ส่งซ่อมครุภัณฑ์) และ UC8 (จัดการการซ่อม/บำรุงรักษา)

### ภาพรวมกระบวนการทำงาน 4 ขั้นตอนหลัก

```
[1. แจ้งซ่อมออนไลน์] ──► [2. ช่างรับงาน & วินิจฉัย] ──► [3. ดำเนินการ & แจ้งแล้วเสร็จ] ──► [4. ตรวจรับ ส่งมอบ & ปิดงาน]
  (User ทั่วไป)          (เลือก Action Type & Steps)       (ทำตาม Steps + แจ้งผู้ส่งซ่อม)       (กรอกวันรับประกัน & ผู้รับคืน)
```

---

### รายละเอียดแต่ละขั้นตอน (Workflow Details)

#### 1. การแจ้งซ่อมออนไลน์ (Online Repair Request)
- **ผู้ดำเนินการ**: เจ้าหน้าที่หน่วยงาน (`DEPARTMENT_STAFF`, `PARCEL_STAFF`, ฯลฯ)
- **ข้อมูลที่บันทึก**:
  - `asset_id`: ครุภัณฑ์ที่ต้องการส่งซ่อม
  - `symptom`: อาการชำรุด หรือบันทึกส่งซ่อม
  - `urgency_status`: ระดับความเร่งด่วน (`NORMAL`, `URGENT`, `EMERGENCY`)
  - `report_type`: ประเภทรายงาน (`Repair` ซ่อมชำรุด, `Maintenance` บำรุงรักษาตามรอบ)
  - `reporter_id`: ผู้แจ้งซ่อม (ดึงจาก Login User)
  - `section_id`: แผนกของผู้แจ้ง/ครุภัณฑ์
  - `createdAt`: วันที่ส่งซ่อม
- **สถานะระบบ**:
  - สร้าง `job_no` อัตโนมัติ (รูปแบบ `REP-YYYYMM-XXXX`)
  - `REPAIR_JOB.job_status_id` = `PENDING` (รอช่างรับงาน)
  - `ASSET.asset_status_id` ➔ `UNDER_REPAIR` (อยู่ระหว่างซ่อม)
  - `ASSET.availability_status_id` ➔ `UNAVAILABLE` (ไม่พร้อมใช้งาน)

#### 2. ช่างรับงาน & วินิจฉัยเลือกประเภทการดำเนินการ (Diagnosis & Action Selection)
- **ผู้ดำเนินการ**: ช่างซ่อมบำรุง (`MAINTENANCE_STAFF`)
- **การรับงาน**: มอบหมายช่างผู้รับผิดชอบบันทึกลงใน `MECHANIC_REPAIR` และปรับสถานะงานซ่อมเป็น `IN_PROGRESS`
- **การวินิจฉัยและวางแผน**:
  - บันทึก `diagnosis` (ผลการตรวจเช็ค/สาเหตุ), `solution` (แนวทางแก้ไข)
  - เลือก `cause_id` (มูลเหตุปัญหา จากตาราง `CAUSE`), `tech_category_id` (หมวดช่าง), `job_type_id` (ประเภทงาน)
  - ระบุ `due_date` (กำหนดแล้วเสร็จโดยประมาณ) และ `is_repeat_repair` (ประวัติการซ่อมซ้ำ)
  - เลือก **ประเภทการดำเนินการ (`action_type`)**:
    - `REPAIR` (ตรวจซ่อม)
    - `FABRICATE` (สร้างใหม่)
    - `MODIFY` (ปรับปรุง)
    - `PREVENTIVE` (เชิงรุก)
  - เลือก **ประเภทขั้นตอนการจัดหา/ดำเนินการ (`step_action_type`)** 1 ใน 5 ประเภทโดยการตัดสินใจของช่าง (Explicit Selection โดยไม่มีการเบิกแบบผสม):
    1. `SELF_REPAIR` (ดำเนินการซ่อมเอง / ไม่ใช้อะไหล่)
    2. `INTERNAL_STOCK` (ขอเบิกอะไหล่ในคลังอย่างเดียว) ➔ ช่างเลือกอะไหล่จาก Master ที่มีพร้อมในคลัง (`qty_in_stock >= qty`) ผูกรายการอะไหล่ `SPAREPART_TXN`
    3. `EXTERNAL_STOCK` (ขอเบิกอะไหล่นอกคลัง / จัดซื้ออะไหล่อย่างเดียว) ➔ ช่างเลือกอะไหล่จาก Master ในระบบ (`SPAREPART`) ที่ของหมดหรือสต็อกไม่พอ เพื่อส่งเรื่องขอจัดซื้อจัดหาภายนอก
    4. `OUTSOURCE` (ส่งซ่อมบริษัทภายนอก) ➔ ผูกบริษัทคู่ค้า `company_id` และเลขใบเสร็จ `bill_no`
    5. `PURCHASE_REPLACEMENT` (ขอซื้อทดแทน / ประเมินไม่คุ้มซ่อม)
- **การสร้างขั้นตอนย่อยอัตโนมัติ (`REPAIR_JOB_STEP`)**:
  - ระบบจะ Clone แม่แบบขั้นตอนจาก `STEP_MASTER` ตามประเภท `step_action_type` ที่เลือก
  - **Form Boundaries:** เมื่อ Submit ฟอร์มรับงาน & วินิจฉัย (`PATCH /repairs/:id/diagnose`) ขั้นตอน Step 2 (ธุรการจ่ายงาน), Step 3 (ช่างวินิจฉัย) และ Step 4 (ตั้งเรื่องขอเบิก/ส่งซ่อม/ซ่อมเอง) จะถูก Auto-completed ทันทีในครั้งเดียว

---

### แม่แบบขั้นตอนของงานซ่อม (Repair Step Master Template & Lifecycle)

> อ้างอิงจากรายละเอียดฉบับสมบูรณ์ใน `docs/repair_flow_matrix.md`:

| Step # | ชื่อขั้นตอน (Label) | กรณีเบิกในคลัง (`INTERNAL_STOCK`) | กรณีเบิกนอกคลัง (`EXTERNAL_STOCK`) | กรณีส่งซ่อมบริษัท (`OUTSOURCE`) | กรณีขอซื้อทดแทน (`PURCHASE_REPLACEMENT`) | กรณีซ่อมเอง (`SELF_REPAIR`) |
|:---:|---|:---:|:---:|:---:|:---:|:---:|
| 1 | วันแจ้งซ่อม | ✅ (ช่วงที่ 1: แจ้งซ่อม) | ✅ (ช่วงที่ 1: แจ้งซ่อม) | ✅ (ช่วงที่ 1: แจ้งซ่อม) | ✅ (ช่วงที่ 1: แจ้งซ่อม) | ✅ (ช่วงที่ 1: แจ้งซ่อม) |
| 2 | ธุรการรับ Job / จ่ายงาน | ✅ (ช่วงที่ 2: ฟอร์มวินิจฉัย) | ✅ (ช่วงที่ 2: ฟอร์มวินิจฉัย) | ✅ (ช่วงที่ 2: ฟอร์มวินิจฉัย) | ✅ (ช่วงที่ 2: ฟอร์มวินิจฉัย) | ✅ (ช่วงที่ 2: ฟอร์มวินิจฉัย) |
| 3 | ช่างรับ Job / วินิจฉัย | ✅ (ช่วงที่ 2: ฟอร์มวินิจฉัย) | ✅ (ช่วงที่ 2: ฟอร์มวินิจฉัย) | ✅ (ช่วงที่ 2: ฟอร์มวินิจฉัย) | ✅ (ช่วงที่ 2: ฟอร์มวินิจฉัย) | ✅ (ช่วงที่ 2: ฟอร์มวินิจฉัย) |
| 4 | ขั้นตอนตั้งต้นของเคส | ขอเบิกอะไหล่ในคลัง | ขอเบิก/จัดซื้อนอกคลัง | ขอส่งซ่อมบริษัทภายนอก | ขอซื้อเครื่องทดแทน | ซ่อมเองและทดสอบ (ช่วงที่ 3) |
| 5 | การอนุมัติ / รอส่งมอบ | อนุมัติจัดหาในคลัง | อนุมัติจัดหานอกคลัง | อนุมัติส่งซ่อมบริษัท | อนุมัติขอซื้อทดแทน | แล้วเสร็จ/รอตรวจรับงาน |
| 6 | การรับพัสดุ / สรุปงาน | พัสดุจ่ายอะไหล่ในคลัง | พัสดุแจ้งรับอะไหล่ | พัสดุรับเครื่องคืนจากบริษัท | พัสดุรับเครื่องใหม่เข้าคลัง | ตรวจรับงานและสรุป Job (ปิดงาน) |
| 7 | ช่างรับมอบ / ดำเนินการ | ช่างรับวัสดุ/ดำเนินการซ่อม | ช่างรับอะไหล่/ดำเนินการซ่อม | ช่างรับเครื่องและทดสอบ | ช่างรับเครื่องใหม่/ส่งมอบ | - |
| 8 | แจ้งแล้วเสร็จ | แล้วเสร็จ / รอตรวจรับงาน | แล้วเสร็จ / รอตรวจรับงาน | แล้วเสร็จ / รอตรวจรับงาน | แล้วเสร็จ / รอตรวจรับงาน | - |
| 9 | ปิดงาน | ตรวจรับงานและสรุป Job | ตรวจรับงานและสรุป Job | ตรวจรับงานและสรุป Job | ตรวจรับงานและสรุป Job | - |

---

### สถานะงานซ่อม (`JobStatus`) 10 สถานะ
1. `WAITING_HANDOVER` (รอรับเครื่องจากหน่วยงาน)
2. `PENDING_ASSIGN` (รอมอบหมายงานให้ช่าง)
3. `IN_PROGRESS` (ช่างกำลังดำเนินการซ่อม)
4. `WAITING_PARTS` (สั่งซื้อ/รออะไหล่)
5. `PARCEL_PROCESSING` (พัสดุกำลังดำเนินการ)
6. `OUTSOURCED` (ส่งซ่อมบริษัทภายนอก)
7. `UNREPAIRABLE` (แทงชำรุด/เห็นควรจำหน่าย)
8. `WAITING_DELIVERY` (เสร็จแล้วรอรับคืน)
9. `COMPLETED` (ส่งคืน/ดำเนินการเรียบร้อย)
10. `CANCELLED` (ยกเลิกงานซ่อม)

---

#### รายละเอียดการตัดสต็อกและบันทึกข้อมูลอะไหล่ในขั้นตอน Step 6 - 9 (Stock Deduction & Transaction Rules)

1. **กรณีเบิกอะไหล่ในคลัง (`INTERNAL_STOCK`)**:
   - **Step 6 (ขอเบิกอะไหล่ในคลัง)**: ช่างเลือกรายการอะไหล่และจำนวน (`qty`) จาก Master `SPAREPART`
   - **Step 7 (อนุมัติจัดหาในคลัง)**: เมื่อผู้มีอำนาจอนุมัติ ระบบจะทำการตัด/กันสต็อกทันที (`SPAREPART.qty_in_stock -= qty`) เพื่อป้องกัน Race Condition จากงานซ่อมอื่น
   - **Step 8 (พัสดุแจ้งรับอะไหล่)**: เจ้าหน้าที่พัสดุเตรียมของและแจ้งพร้อมส่งมอบ
   - **Step 9 (ช่างรับวัสดุในคลัง)**: ช่างกดรับมอบของจริง บันทึกประวัติ `SPAREPART_TXN` (ประเภท `WITHDRAW`, บันทึก `unit_price` ณ วันเบิก, `job_id`, `txn_by`)

2. **กรณีขอเบิกอะไหล่นอกคลัง / สั่งซื้อ (`EXTERNAL_STOCK`)**:
   - **Step 6 (ขอเบิกอะไหล่นอกคลัง)**: ช่างเลือกรายการอะไหล่ที่สต็อกไม่พอเพื่อตั้งเรื่องขอซื้อ
   - **Step 7 (อนุมัติจัดหานอกคลัง)**: ผู้บริหาร/ผู้มีอำนาจอนุมัติสั่งซื้อ
   - **Step 8 (พัสดุแจ้งรับอะไหล่)**: พัสดุตรวจรับของจากผู้ขาย บันทึกการรับเข้าผ่าน `SPAREPART_ADD` (`SPAREPART.qty_in_stock += qty`, บันทึกเลขเอกสารจัดซื้อ `sparepart_add_doc`, ราคารวม `total_price`)
   - **Step 9 (ช่างรับอะไหล่)**: ช่างกดรับมอบของจริง ระบบตัดสต็อกจ่ายงานซ่อมทันที (`SPAREPART.qty_in_stock -= qty`) พร้อมบันทึก `SPAREPART_TXN` (`WITHDRAW` ผูกกับ `job_id` เพื่อคิดต้นทุนงานซ่อม)

3. **การคืนอะไหล่ที่เหลือ/ไม่ได้ใช้งานกลับเข้าคลัง (`SPAREPART_TXN` - `RETURN`)**:
   - ช่างสามารถทำรายการคืนอะไหล่ส่วนที่เบิกเกินหรือไม่ได้ใช้งานจริงได้ก่อนการปิดงานซ่อม (ก่อน Step 12)
   - ระบบจะเพิ่มสต็อกคืนคลัง (`SPAREPART.qty_in_stock += return_qty`)
   - บันทึกประวัติ `SPAREPART_TXN` ด้วย `txn_type = 'RETURN'` โดยผูกกับ `job_id` เดิม เพื่อคำนวณต้นทุนการใช้อะไหล่สุทธิ (`WITHDRAW` - `RETURN`) ได้อย่างถูกต้องแม่นยำ

4. **การป้องกันการเบิกแบบผสม (Mixed Requisition Prevention & Validation Rules)**:
   - **กรณี `INTERNAL_STOCK` (เบิกในคลัง)**:
     - Frontend กรองแสดงเฉพาะอะไหล่ที่มีสต็อก (`qty_in_stock > 0`) และจำกัดให้ระบุจำนวน `qty <= qty_in_stock`
     - Backend API Validate สต็อกทุกรายการ หากพบว่ารายการใดมี `qty_in_stock < qty` จะปฏิเสธคำขอด้วย `400 Bad Request` พร้อมแจ้งเตือนให้สลับไปเลือกประเภท `EXTERNAL_STOCK`
   - **กรณี `EXTERNAL_STOCK` (เบิกนอกคลัง/สั่งซื้อ)**:
     - ทุกรายการอะไหล่ที่เลือกในใบงานนี้จะถูกส่งเข้า Flow ขอจัดซื้อจัดหาภายนอกทั้งหมด (ไม่นำอะไหล่ในคลังมาปะปน)
     - ป้องกันการเกิดสถานะก้ำกึ่งระหว่างรอของนอกและเบิกของในพร้อมกัน

#### 3. การดำเนินการซ่อมและการแจ้งแล้วเสร็จ (Progress & Completion Notification)
- ช่างกดอัปเดตบันทึกเวลา `completeAt` เมื่อทำแต่ละขั้นตอนย่อยสำเร็จ
- เมื่อซ่อมเสร็จ ช่างจะกดบันทึกขั้นตอนที่ 11 **"แล้วเสร็จ"** ➔ ระบบส่งการแจ้งเตือนไปยังผู้ส่งซ่อม/แผนกเจ้าของเครื่องให้เตรียมมารับเครื่องคืน

#### 4. การส่งมอบคืน ตรวจรับ และปิดสรุปงาน (Handover, Warranty & Close Job)
- เมื่อผู้ส่งซ่อม/เจ้าหน้าที่แผนกมารับเครื่องคืน:
  - บันทึก **ขั้นตอนที่ 10 (ประกันงานซ่อมถึงวันที่)**
  - บันทึก **ขั้นตอนที่ 11 (วันที่ส่งมอบคืน `return_date` และผู้รับคืน `receiver_id`)**
- ดำเนินการ **ขั้นตอนที่ 12 (สรุป Job / ปิดงาน)**:
  - `REPAIR_JOB.job_status_id` ➔ `COMPLETED`
  - `ASSET.asset_status_id` ➔ ปลดกลับเป็น `NORMAL` (ปกติ)
  - `ASSET.availability_status_id` ➔ ปลดกลับเป็น `AVAILABLE` (ว่าง/พร้อมใช้งาน)
  *(หมายเหตุ: กรณี `PURCHASE_REPLACEMENT` ครุภัณฑ์เดิมจะถูกปรับสถานะเป็น `WAIT_DISPOSAL` หรือ `DISPOSAL` ตามขั้นตอนการตัดจำหน่าย)*

---

## Data Models: Maintenance & Spare Parts (Lookup & Transactional)

### SPAREPART (ตารางอะไหล่)
| Column | Type | Required | FK | Description |
|---|---|---|---|---|
| `sparepart_id` | INT | ✅ PK | | ID อะไหล่ |
| `sparepart_code` | VARCHAR(100) | ✅ | | รหัสอะไหล่ |
| `name` | VARCHAR(100) | ✅ | | ชื่ออะไหล่ |
| `unit` | INT | ✅ | | หน่วยนับ |
| `price` | NUMERIC(15,2) | ✅ | | ราคาต่อหน่วย |
| `min_stock` | INT | ✅ | | จำนวนขั้นต่ำเตือนสั่งซื้อ |
| `qty_in_stock` | INT | ✅ | | จำนวนคงเหลือในคลัง |
| `group_id` | INT | ✅ | SPAREPART_GROUP | กลุ่มหมวดหมู่อะไหล่ |
| `createdAt` | TIMESTAMPTZ | ✅ | | |
| `updatedAt` | TIMESTAMPTZ | ✅ | | |
| `deletedAt` | TIMESTAMPTZ | | | Soft delete |

### SPAREPART_ADD (ใบสั่งซื้อ/รับอะไหล่เข้าคลัง)
| Column | Type | Required | FK | Description |
|---|---|---|---|---|
| `sparepart_add_id` | INT | ✅ PK | | ID ใบสั่งซื้อ/รับเข้า |
| `sparepart_id` | INT | ✅ | SPAREPART | อะไหล่ที่รับเข้า |
| `qty` | INT | ✅ | | จำนวนที่เพิ่มเข้าคลัง |
| `total_price` | NUMERIC(15,2) | ✅ | | ราคารวม |
| `sparepart_add_doc` | VARCHAR(100) | ✅ | | เลขเอกสารจัดซื้อ/ใบเสร็จ |
| `add_by` | UUID | ✅ | USER | ผู้บันทึกรับเข้า |
| `createdAt` | TIMESTAMPTZ | ✅ | | |
| `updatedAt` | TIMESTAMPTZ | ✅ | | |
| `deletedAt` | TIMESTAMPTZ | | | |

### SPAREPART_TXN (ประวัติการเบิก-คืนอะไหล่ในงานซ่อม)
| Column | Type | Required | FK | Description |
|---|---|---|---|---|
| `txn_id` | INT | ✅ PK | | ID ประวัติรายการ |
| `sparepart_id` | INT | ✅ | SPAREPART | อะไหล่ที่เบิก/คืน |
| `job_id` | UUID | ✅ | REPAIR_JOB | งานซ่อมที่เบิกใช้ |
| `txn_type` | VARCHAR(100) | ✅ | | ประเภท (`WITHDRAW`, `RETURN`) |
| `qty` | INT | ✅ | | จำนวน |
| `unit_price` | NUMERIC(15,2) | ✅ | | ราคา Snapshot ต่อหน่วย ณ วันเบิก |
| `txn_date` | TIMESTAMPTZ | ✅ | | วันเวลาที่ทำรายการ |
| `txn_by` | UUID | ✅ | USER | ผู้ทำรายการ |
| `createdAt` | TIMESTAMPTZ | ✅ | | |

### REPAIR_JOB (ใบแจ้งซ่อม/บำรุงรักษา)
| Column | Type | Required | FK | Description |
|---|---|---|---|---|
| `job_id` | UUID | ✅ PK | | ID ของงานซ่อม |
| `job_no` | VARCHAR(255) | ✅ | | รหัสงานซ่อม (เช่น REP-202608-0001) |
| `asset_id` | UUID | ✅ | ASSET | ครุภัณฑ์ที่ซ่อม |
| `section_id` | UUID | ✅ | SECTION | แผนกเจ้าของเครื่อง |
| `reporter_id` | UUID | ✅ | USER | ผู้แจ้งซ่อม |
| `job_type_id` | INT | ✅ | JOB_TYPE | ประเภทงานซ่อม |
| `report_type` | ENUM | ✅ | | `Repair` / `Maintenance` |
| `job_status_id` | INT | ✅ | JOB_STATUS | สถานะงานซ่อม |
| `company_id` | UUID | | COMPANY | บริษัทคู่ค้า (กรณีส่งซ่อมนอก) |
| `bill_no` | TEXT | | | เลขใบเสร็จค่าซ่อม |
| `diagnosis` | TEXT | | | ผลการวินิจฉัย/สาเหตุ |
| `symptom` | TEXT | | | บันทึกส่งซ่อม/อาการเบื้องต้น |
| `solution` | TEXT | | | วิธีการแก้ไข |
| `cause_id` | INT | | CAUSE | มูลเหตุของปัญหา |
| `action_type` | ENUM | | | ประเภทการดำเนินการ (`REPAIR`, `FABRICATE`, `MODIFY`, `PREVENTIVE`) |
| `urgency_status` | ENUM | ✅ | | `NORMAL` / `URGENT` / `EMERGENCY` |
| `due_date` | TIMESTAMPTZ | | | กำหนดแล้วเสร็จโดยประมาณ |
| `return_date` | TIMESTAMPTZ | | | วันที่ส่งมอบคืน |
| `is_repeat_repair` | BOOLEAN | | | ซ่อมซ้ำอาการเดิมหรือไม่ |
| `tech_category_id` | INT | | TECH_CATEGORY | หมวดช่างที่รับผิดชอบ |
| `receiver_id` | UUID | | USER | ผู้รับมอบเครื่องคืน |
| `createdAt` | TIMESTAMPTZ | ✅ | | วันเวลาแจ้งซ่อม |
| `created_by` | UUID | ✅ | USER | ผู้สร้างรายการ |
| `updatedAt` | TIMESTAMPTZ | ✅ | | |
| `updated_by` | UUID | ✅ | USER | |

### REPAIR_JOB_STEP (ขั้นตอนย่อยงานซ่อม)
| Column | Type | Required | FK | Description |
|---|---|---|---|---|
| `step_id` | INT | ✅ PK | | ID ขั้นตอนย่อย |
| `job_id` | UUID | ✅ | REPAIR_JOB | งานซ่อมที่สังกัด |
| `step_master_id` | INT | ✅ | STEP_MASTER | แม่แบบขั้นตอน |
| `completeAt` | TIMESTAMPTZ | | | วันเวลาที่ทำเสร็จ |

### MECHANIC_REPAIR (ช่างผู้รับผิดชอบงานซ่อม)
| Column | Type | Required | FK | Description |
|---|---|---|---|---|
| `mechanic_repair_id` | INT | ✅ PK | | ID รายการ |
| `job_id` | UUID | ✅ | REPAIR_JOB | งานซ่อม |
| `user_id` | UUID | ✅ | USER | ช่างผู้รับผิดชอบ |
| `createdAt` | TIMESTAMPTZ | ✅ | | |
| `updatedAt` | TIMESTAMPTZ | ✅ | | |
| `deleteAt` | TIMESTAMPTZ | | | Soft delete |

