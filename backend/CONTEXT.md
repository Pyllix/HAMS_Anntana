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

### Asset Status & Initial State
- **Initial State**: `NORMAL` (เมื่อลงทะเบียนครุภัณฑ์ใหม่เข้าระบบ)
- **Available Statuses**: `NORMAL` (ปกติ), `DAMAGED` (ชำรุด), `UNDER_REPAIR` (อยู่ระหว่างซ่อม), `WAIT_DISPOSAL` (รอจำหน่าย), `DISPOSAL` (จำหน่ายแล้ว), `LOST` (สูญหาย)

### Status Transition Rules
- **แจ้งชำรุด (Report Damage)**: `NORMAL` → `DAMAGED` (เกิดจากแจ้งชำรุดขณะคืน, เจ้าหน้าที่แจ้ง, หรือระบบแจ้งซ่อม)
- **ส่งซ่อม (Send to Repair)**: `DAMAGED` → `UNDER_REPAIR`
- **ซ่อมเสร็จ (Repair Complete)**: `UNDER_REPAIR` → `NORMAL`
- **รอจำหน่าย (Pending Disposal)**: `NORMAL`, `DAMAGED`, `UNDER_REPAIR` → `WAIT_DISPOSAL`
- **จำหน่ายเสร็จสิ้น (Disposed)**: `WAIT_DISPOSAL` → `DISPOSAL` (ต้องระบุเหตุผล เช่น เสียหาย, เสื่อมตามอายุการใช้งาน, บริจาค, หรืออื่นๆ)
- **สูญหาย (Lost)**: `NORMAL`, `DAMAGED`, `UNDER_REPAIR` → `LOST` (ต้องบันทึกรายละเอียดการสูญหาย)

### Terminal States
- **`DISPOSAL`** และ **`LOST`** ถือเป็นสถานะสิ้นสุด (Terminal States) 
- ไม่สามารถเปลี่ยนกลับเป็นสถานะอื่นได้ผ่านระบบปกติ (ยกเว้นผู้ดูแลระบบ Admin ดำเนินการแก้ไขข้อมูลพร้อมบันทึก Audit Log)

### History Tables

| Table | Purpose | Trigger |
|---|---|---|
| `asset_lost` | Records each lost event (date, location, reason) | When status → `LOST` |
| `asset_disposal` | Tracks two-phase disposal (Pending → Disposed) | When status → `WAIT_DISPOSAL` / `DISPOSAL` |

### Disposal Workflow (2-phase)

```
POST  /asset/:id/disposal        → create AssetDisposal (disposal_status = WAIT_DISPOSAL) + pendingReason
PATCH /asset/:id/disposal/:id    → update to DISPOSAL + disposalReason + remark + disposedAt
```

### Endpoint: Change Asset Status

```
PATCH /asset/:id/status
Body: { asset_status_id: number }
```

---

## Borrow & Return Flow (การยืม-คืนครุภัณฑ์)

> อ้างอิงจาก Activity Diagram "การยืม-คืน", UC1, UC7, SRS FN-BOR-01 ถึง FN-BOR-06 และ Data Dictionary (BORROW_TRANSACTION, BORROW_STATUS)

### Actors (Swimlanes)

| Actor | บทบาท |
|---|---|
| **ผู้ใช้ / เจ้าหน้าที่หน่วยงาน** (Department Staff) | ยืมครุภัณฑ์ผ่านแอปด้วยตนเอง, คืนครุภัณฑ์ |
| **เจ้าหน้าที่ศูนย์ครุภัณฑ์** (Asset Center Staff) | ทำเรื่องยืมให้, ตรวจสอบสถานะ, รับคืน, นำส่ง/มารับคืน, อัปเดตสถานะครุภัณฑ์ |

### รูปแบบการยืม (Borrow Modes)

| Mode | ผู้ดำเนินการ | รายละเอียด |
|---|---|---|
| **ยืมผ่านแอป** (Self-Service) | เจ้าหน้าที่หน่วยงาน | กดยืมเองจากแอป → เลือกวิธีรับครุภัณฑ์ |
| **เจ้าหน้าที่ศูนย์ทำให้** (Staff-Assisted) | เจ้าหน้าที่ศูนย์ครุภัณฑ์ | เจ้าหน้าที่ศูนย์เป็นคนสร้างรายการยืมแทนผู้ยืม |

### รูปแบบการคืน (Return Modes)

| Mode | ค่าใน `return_method` | รายละเอียด |
|---|---|---|
| **นำไปคืนเอง** (Self-Return) | `self_return` | ผู้ยืมนำครุภัณฑ์ไปคืนที่ศูนย์ครุภัณฑ์ |
| **ให้เจ้าหน้าที่มารับคืน** (Staff-Pickup) | `staff_pickup` | เจ้าหน้าที่ศูนย์ไปรับครุภัณฑ์คืนที่แผนก |

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
  │   ผู้ยืม/แผนก, วันที่ยืม, ปุ่มจัดการ)                      │
  │                                                       │
  ├─ กดปุ่ม "ยืมของ"                                       │
  │  (เฉพาะครุภัณฑ์สถานะ "ว่าง")                              │
  │                                                       │
  ├─ ระบบแสดง Dialog "ทำรายการยืมครุภัณฑ์"                    │
  │                                                       │
  ├─ กรอกข้อมูลการยืม:                                      │
  │  • ชื่อ-นามสกุลผู้ยืม (บังคับ)                              │
  │  • แผนก/วอร์ด (บังคับ)                                   │
  │  • วันที่และเวลาที่ยืม (บังคับ)                             │
  │  • วิธีรับครุภัณฑ์ (บังคับ):                                │
  │    ◇──[มารับด้วยตนเอง]──→ ผู้ยืมไปรับที่ศูนย์              │
  │    └──[ให้เจ้าหน้าที่นำไปส่ง]──→ เจ้าหน้าที่ส่งไปที่แผนก    │
  │                                                       │
  ├─ กดปุ่ม "ยืนยันการขอยืม"                                 │
  │                                            ┌──────────┤
  │                                            │          │
  │                                 ตรวจสอบสถานะครุภัณฑ์      │
  │                                            │          │
  │                                           ◇           │
  │                                          ╱ ╲          │
  │                              ไม่ว่าง ◄──╱   ╲──► ว่าง   │
  │                                 │     ╲   ╱     │     │
  │                                 ▼      ╲ ╱      ▼     │
  │                     แจ้งผู้ใช้ว่าครุภัณฑ์    อนุมัติรับ     │
  │                    ไม่พร้อมใช้งาน ⊗    คำขอการยืม       │
  │                                            │          │
  │                                    อัปเดตสถานะ         │
  │                                   ครุภัณฑ์ → BORROWED   │
  │                                            │          │
  ◄────────────────────────────────────────────┘          │
  │                                                       │
  ├─ ระบบปิด Dialog, อัปเดตรายการ                            │
  │                                                       │
```

### Flow 1B: เจ้าหน้าที่ศูนย์ทำเรื่องยืมให้ (Staff-Assisted Borrow)

```
[เจ้าหน้าที่หน่วยงาน]                                [เจ้าหน้าที่ศูนย์ครุภัณฑ์]
  │                                                       │
  │                                                  ● Start
  │                                                       │
  │                                   เลือกเมนู "ยืม-คืนครุภัณฑ์"
  │                                                       │
  │                                   กดปุ่ม "ทำรายการยืมแทน"
  │                                                       │
  │                                   กรอกข้อมูลการยืม:     │
  │                                   • ครุภัณฑ์ที่ต้องการยืม  │
  │                                   • ผู้ยืม (เลือก user)   │
  │                                   • แผนก/วอร์ด          │
  │                                   • วันที่และเวลา        │
  │                                                       │
  │                                   ตรวจสอบสถานะ          │
  │                                   + สร้างรายการยืม       │
  │                                   + อัปเดต → BORROWED   │
  │                                                       │
  │  ◄──── ระบบแจ้งเตือนผู้ยืม ────────┘                     │
  │                                                       │
```

### Flow 2: การคืนครุภัณฑ์ (Return Flow)

```
[ผู้ยืม / เจ้าหน้าที่หน่วยงาน]                        [เจ้าหน้าที่ศูนย์ครุภัณฑ์]
  │                                                       │
  ├─◇ วิธีการคืน?                                          │
  │  │                                                    │
  │  ├─[นำไปคืนเอง: self_return]                            │
  │  │   │                                                │
  │  │   ├─ นำครุภัณฑ์ไปที่ศูนย์ ──────────────────────────────┤
  │  │                                                    │
  │  ├─[ให้เจ้าหน้าที่มารับคืน: staff_pickup]                  │
  │  │   │                                                │
  │  │   ├─ กดปุ่ม "ขอให้มารับคืน" ────────────────────────────┤
  │  │   │                                 เจ้าหน้าที่ไปรับ   │
  │  │   │                                 ครุภัณฑ์ที่แผนก    │
  │  │                                                    │
  │  └───────────────────────────────────────► ทำรายการรับคืน │
  │                                                       │
  │                                   ระบบแสดง Dialog       │
  │                                   "ทำรายการรับคืนครุภัณฑ์"  │
  │                                   แสดงข้อมูล: ชื่อ, รหัส,  │
  │                                   สถานะ, ผู้ยืม, แผนก     │
  │                                                       │
  │                                   ระบุข้อมูลการคืน:       │
  │                                   • return_condition:   │
  │                                     ◇──[Normal]──→ ปกติ │
  │                                     └──[Damage]──→ ชำรุด │
  │                                   • return_date         │
  │                                   • return_method       │
  │                                     (self_return /      │
  │                                      staff_pickup)      │
  │                                   • return_remark       │
  │                                     (ถ้ามี)              │
  │                                                       │
  │                                   กดปุ่ม "ยืนยันรับคืน"    │
  │                                          │             │
  │                                         ◇             │
  │                                        ╱ ╲            │
  │                            Damage ◄──╱   ╲──► Normal  │
  │                               │    ╲   ╱      │      │
  │                               ▼     ╲ ╱       ▼      │
  │                            ส่งซ่อม          ปิดรับคืน   │
  │                          (DAMAGED)      (AVAILABLE)    │
  │                               │             │         │
  │                               └──────┬──────┘         │
  │                                      ▼                │
  │                              อัปเดตสถานะครุภัณฑ์        │
  │                              + บันทึกประวัติ            │
  │                                      │                │
  ◄──────────────────────────────────────┘                │
  │                                                       │
  ● End                                                   │
```

---

### Data Model: BORROW_TRANSACTION

> อ้างอิงจาก Data Dictionary

| Column | Type | Required | FK → | Description |
|---|---|---|---|---|
| `borrow_transaction_id` | UUID | ✅ PK | | ID ของรายการยืม-คืน |
| `asset_id` | UUID | ✅ | ASSET | ครุภัณฑ์ที่ยืม |
| `borrower_id` (user_id) | UUID | ✅ | USER | ผู้ยืม |
| `returned_by_user_id` | UUID | | USER | ผู้คืน (อาจไม่ใช่ผู้ยืม) |
| `received_by_user_id` | UUID | | USER | เจ้าหน้าที่ผู้รับคืน |
| `borrow_status_id` | INTEGER | ✅ | BORROW_STATUS | สถานะรายการยืม-คืน |
| `request_source` | ENUM | ✅ | | แหล่งที่มาของการยืม: `SELF_SERVICE` / `CENTER_SERVICE` |
| `delivery_method` | ENUM | ✅ | | วิธีรับครุภัณฑ์ตอนยืม: `PICKUP` / `DELIVERY` |
| `createdAt` | TIMESTAMPTZ | ✅ | | วันเวลาที่สร้างรายการ (= วันที่ยืม) |
| `return_date` | TIMESTAMPTZ | | | วันเวลาที่คืน |
| `return_condition` | ENUM | | | สภาพเครื่องตอนคืน: `Normal` / `Damage` |
| `return_method` | ENUM | | | วิธีการคืน: `self_return` / `staff_pickup` |
| `return_remark` | TEXT | | | หมายเหตุการคืน |

### Data Model: BORROW_STATUS (Lookup Table)

| Column | Type | Required | Description |
|---|---|---|---|
| `borrow_status_id` | INTEGER | ✅ PK | ID ของสถานะ |
| `status_code` | VARCHAR(20) | ✅ | รหัสสถานะ (eng) |
| `status_name` | VARCHAR(50) | ✅ | ชื่อสถานะ (thai) |
| `createdAt` | TIMESTAMPTZ | ✅ | |
| `updatedAt` | TIMESTAMPTZ | ✅ | |
| `deleteAt` | TIMESTAMPTZ | | Soft delete |

### Borrow Status Values (สถานะรายการยืม-คืน)

| status_code | status_name | ความหมาย |
|---|---|---|
| `BORROWED` | กำลังยืม | ครุภัณฑ์ถูกยืมไปใช้งาน |
| `RETURNED` | คืนแล้ว | ครุภัณฑ์ถูกส่งคืนเรียบร้อย |
| `CANCELLED` | ยกเลิก | รายการยืมถูกยกเลิก |

### AVAILABILITY_STATUS (สถานะพร้อมใช้งาน — แยกจาก ASSET_STATUS)

> ใช้ `availability_status_id` บน ASSET เพื่อติดตามว่าครุภัณฑ์ว่างหรือไม่ แยกจาก `asset_status_id` (NORMAL/DAMAGED/...) ที่ติดตามสภาพ

| status_code | status_name | ความหมาย |
|---|---|---|
| `AVAILABLE` | ว่าง | ครุภัณฑ์พร้อมให้ยืม |
| `BORROWED` | กำลังยืม | ครุภัณฑ์ถูกยืมอยู่ |
| `UNAVAILABLE` | ไม่พร้อมใช้งาน | ครุภัณฑ์ไม่พร้อมให้ยืม (เช่น ซ่อม, จำหน่าย) |

### Business Rules

1. **เฉพาะครุภัณฑ์ที่ `availability_status` = AVAILABLE** เท่านั้นที่สามารถยืมได้ — ตรวจสอบแบบ Real-time (FN-BOR-06)
2. **เฉพาะรายการยืมที่ `borrow_status` = BORROWED** เท่านั้นที่สามารถรับคืนได้
3. **Race Condition Protection**: หากครุภัณฑ์ถูกยืมโดยผู้อื่นระหว่างที่ผู้ใช้กำลังกรอกข้อมูล → แจ้งเตือน "ครุภัณฑ์นี้ไม่สามารถทำรายการได้ในขณะนี้"
4. **Validation**: ต้องกรอกข้อมูลบังคับครบทุกฟิลด์ก่อนยืนยัน → แสดง error ใต้ฟิลด์ที่ยังไม่ได้กรอก
5. **สภาพครุภัณฑ์หลังคืน** (`return_condition`):
   - `Normal` → `asset_status` คงเดิม, `availability_status` → `AVAILABLE`
   - `Damage` → `asset_status` → `DAMAGED`, `availability_status` → `AVAILABLE` → เข้าสู่ flow ส่งซ่อม
6. **ประวัติการยืม-คืน**: ทุกรายการยืม-คืนบันทึกเป็น row ใน `BORROW_TRANSACTION` (BR-04)
7. **ระยะเวลาที่ยืม**: คำนวณอัตโนมัติจาก `createdAt` ถึง `return_date` (FN-BOR-03)
8. **ผู้คืนอาจไม่ใช่ผู้ยืม**: `returned_by_user_id` เก็บแยกจาก `borrower_id`
9. **ผู้รับคืน**: `received_by_user_id` บันทึกว่าเจ้าหน้าที่คนไหนเป็นผู้รับคืน
10. **ยืมแบบ Staff-Assisted**: เจ้าหน้าที่ศูนย์สร้าง transaction โดยระบุ `borrower_id` เป็น user อื่น

### Status Transition (เฉพาะ Borrow & Return)

```
ASSET.availability_status:

                ยืม (Borrow)                    คืน (Return)
  AVAILABLE ──────────────────► BORROWED ──────────────────────► AVAILABLE
  (ว่าง)                       (กำลังยืม)                        (ว่าง)
      ▲                                                         │
      │                     ซ่อม / จำหน่าย                        │
      └──── กลับมาใช้ได้ ◄──── UNAVAILABLE ◄────────────────────┘
                              (ไม่พร้อมใช้งาน)     (เมื่อคืนชำรุด)


BORROW_TRANSACTION.borrow_status:

                สร้างรายการยืม                   ยืนยันรับคืน
  (ไม่มี) ─────────────────────► BORROWED ─────────────────────► RETURNED
                                 (กำลังยืม)  │                   (คืนแล้ว)
                                             │
                                             │  ยกเลิกการยืม
                                             └─────────────────► CANCELLED
                                                                 (ยกเลิก)


ASSET.asset_status (เมื่อคืนชำรุด):

  NORMAL ──── คืนแบบ Damage ────► DAMAGED → เข้า flow ส่งซ่อม
```