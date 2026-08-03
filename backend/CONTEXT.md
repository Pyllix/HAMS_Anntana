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