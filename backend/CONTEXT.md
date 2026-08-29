# CONTEXT.md

## Project Overview
The Hospital Asset & Maintenance System (HAMS) is a centralized web application designed to manage hospital assets and maintenance workflows. It serves as a single source of truth to minimize data redundancy, track assets in real-time, and streamline processes ranging from borrowing equipment to tracking spare parts and repairs.

## Business Domain
- **Asset (ครุภัณฑ์)**: Physical equipment or property owned by the hospital managed within the system. Asset records are **never deleted** — lifecycle changes are handled by updating `asset_status_id` to statuses such as Lost or Disposal.
- **AssetStatus (สถานะครุภัณฑ์)**: Lookup table driving all asset lifecycle states (e.g. In Use, Lost, Pending Disposal, Disposed). Shared by both `Asset` and `AssetDisposal` models.
- **AssetLost (ประวัติการสูญหาย)**: History record capturing details each time an asset is reported lost (date discovered, last seen location, reason).
- **AssetDisposal (ประวัติการจำหน่าย)**: History record tracking the two-phase disposal workflow — Pending Disposal → Disposed.
- **Department (หน่วยงาน / แผนก)**: Internal hospital units or wards where assets are stationed or utilized.
- **Spare Part (อะไหล่)**: Inventory items and parts used specifically for the repair and maintenance of assets.
- **Maintenance Ticket (ใบแจ้งซ่อม / งานซ่อม)**: A documented request generated when an asset requires repair or scheduled maintenance.
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
| Auth | BetterAuth | Confirmed | Known decision; pending codebase integration |

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
- `AssetStatus` is also reused as `disposal_status_id` in `AssetDisposal` to avoid a separate enum.

---

## Status Tables (Lookup Tables)

ทั้งสาม Status เป็น Lookup Tables ใน Database ที่ Seed ไว้ตั้งแต่ต้น โดยมี column ชื่อ `status_code` (VARCHAR 20) และ `status_name` (VARCHAR 50) เหมือนกันทุกตาราง

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

| status_code        | status_name        | ความหมาย                    |
|--------------------|--------------------|-----------------------------|
| `PENDING_APPROVAL` | รออนุมัติ           | ส่งคำขอยืม รอเจ้าหน้าที่ศูนย์อนุมัติ |
| `APPROVED`         | อนุมัติแล้ว         | เจ้าหน้าที่ศูนย์อนุมัติแล้ว รอส่งมอบของจริง |
| `BORROWED`         | กำลังยืม           | ส่งมอบครุภัณฑ์จริงแล้ว (อยู่ระหว่างใช้งาน) |
| `RETURNED`         | คืนแล้ว            | ครุภัณฑ์ถูกส่งคืนเรียบร้อย    |
| `REJECTED`         | ปฏิเสธ             | คำขอยืมถูกปฏิเสธ             |
| `CANCELLED`        | ยกเลิก             | รายการยืมถูกยกเลิก             |

---

## Status Transition Rules

### AssetStatus Transitions

```
NORMAL        ──► DAMAGED / WAIT_DISPOSAL / LOST
DAMAGED       ──► UNDER_REPAIR / WAIT_DISPOSAL / LOST
UNDER_REPAIR  ──► NORMAL / WAIT_DISPOSAL / LOST
WAIT_DISPOSAL ──► DISPOSAL  (Terminal → END)
DISPOSAL      ──► END       (Terminal)
LOST          ──► END       (Terminal)
```

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

> อ้างอิงจาก `docs/status_role.md`

| # | Event | AssetStatus | AvailabilityStatus | BorrowStatus | หมายเหตุ |
|---|-------|-------------|--------------------|--------------|---|
| 1 | **AssetStatus controls Availability** | — | เฉพาะ `NORMAL` เท่านั้นที่มี `AVAILABLE`, `RESERVED` หรือ `BORROWED` ได้ สถานะอื่น → `UNAVAILABLE` | — | กฎบังคับพื้นฐาน |
| 2 | **ยื่นขอยืม (Self-Service)** | ไม่เปลี่ยน | `AVAILABLE → RESERVED` | `→ PENDING_APPROVAL` | บันทึก `createdAt` |
| 3 | **อนุมัติการยืม (Approve)** | ไม่เปลี่ยน | คง `RESERVED` | `PENDING_APPROVAL → APPROVED` | บันทึก `approved_at` |
| 4 | **ส่งมอบของจริง (Handover/Dispatch)** | ไม่เปลี่ยน | `RESERVED → BORROWED` | `APPROVED → BORROWED` | บันทึก `handover_date` |
| 5 | **ยืมตรงที่ศูนย์ (Center-Service)** | ไม่เปลี่ยน | `AVAILABLE → BORROWED` | `→ BORROWED` | บันทึก `approved_at`, `handover_date` ทันที |
| 6 | **ปฏิเสธคำขอ (Reject)** | ไม่เปลี่ยน | `RESERVED → AVAILABLE` | `→ REJECTED` | บันทึก `reject_reason` |
| 7 | **ยกเลิกคำขอ (Cancel - Pending/Approved)** | ไม่เปลี่ยน | `RESERVED → AVAILABLE` | `→ CANCELLED` | เฉพาะก่อนส่งมอบของ |
| 8 | **คืนปกติ (Return - Normal)** | ไม่เปลี่ยน | `BORROWED → AVAILABLE` | `→ RETURNED` | บันทึก `return_date` |
| 9 | **คืนชำรุด (Return - Damage)** | `NORMAL → DAMAGED` | `BORROWED → UNAVAILABLE` | `→ RETURNED` | บันทึก `return_date` |
| 10 | **ส่งซ่อม (Send to Repair)** | `DAMAGED → UNDER_REPAIR` | คง `UNAVAILABLE` | — | |
| 11 | **ซ่อมเสร็จ (Repair Complete)** | `UNDER_REPAIR → NORMAL` | `UNAVAILABLE → AVAILABLE` | — | |
| 12 | **รอจำหน่าย (Pending Disposal)** | `NORMAL/DAMAGED/UNDER_REPAIR → WAIT_DISPOSAL` | `→ UNAVAILABLE` | — | |
| 13 | **จำหน่ายแล้ว (Disposal Completed)** | `WAIT_DISPOSAL → DISPOSAL` | คง `UNAVAILABLE` | — | |
| 14 | **สูญหาย (Asset Lost)** | `NORMAL/DAMAGED/UNDER_REPAIR → LOST` | `→ UNAVAILABLE` | — | |

---

## Validation Rules

- Asset ที่ AssetStatus ≠ `NORMAL` **ห้าม**มี AvailabilityStatus = `AVAILABLE` หรือ `BORROWED`
- Asset ที่ AssetStatus = `DISPOSAL` หรือ `LOST` **ไม่สามารถสร้างรายการยืมใหม่ได้**
- การยืมสามารถเกิดขึ้นได้เฉพาะเมื่อ AssetStatus = `NORMAL` **และ** AvailabilityStatus = `AVAILABLE` เท่านั้น

---

## Disposal Workflow (2-phase)

```
POST  /asset/:id/disposal        → create AssetDisposal (disposal_status = WAIT_DISPOSAL) + pendingReason
PATCH /asset/:id/disposal/:id    → update to DISPOSAL + disposalReason + remark + disposedAt
```

### History Tables

| Table | Purpose | Trigger |
|---|---|---|
| `asset_lost` | Records each lost event (date, location, reason) | When AssetStatus → `LOST` |
| `asset_disposal` | Tracks two-phase disposal (Pending → Disposed) | When AssetStatus → `WAIT_DISPOSAL` / `DISPOSAL` |

### Endpoint: Change Asset Status

```
PATCH /asset/:id/status
Body: { asset_status_id: number }
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
| `reject_reason` | TEXT | | | เหตุผลการปฏิเสธคำขอยืม (เฉพาะกรณี REJECTED) |

## Data Model: BORROW_STATUS (Lookup Table)

| Column | Type | Required | Description |
|---|---|---|---|
| `borrow_status_id` | INTEGER | ✅ PK | ID ของสถานะ |
| `status_code` | VARCHAR(20) | ✅ | รหัสสถานะ (eng) |
| `status_name` | VARCHAR(50) | ✅ | ชื่อสถานะ (thai) |
| `createdAt` | TIMESTAMPTZ | ✅ | |
| `updatedAt` | TIMESTAMPTZ | ✅ | |
| `deletedAt` | TIMESTAMPTZ | | Soft delete |
