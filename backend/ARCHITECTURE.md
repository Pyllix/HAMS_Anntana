# ARCHITECTURE.md

> Describes the high-level architecture of the Hospital Asset Management System.
> Update this document when structural decisions change.

---

## System Overview

A single-hospital asset management platform consisting of:
- A **React SPA** (frontend) served separately from the API
- A **NestJS REST API** (backend) as the system core
- A **PostgreSQL** database managed via Prisma ORM
- A **File Storage** layer for asset-related documents and images
- **BetterAuth** handling authentication with JWT

```
┌─────────────────┐         HTTPS / REST          ┌──────────────────────┐
│   React SPA     │ ─────────────────────────────► │   NestJS REST API    │
│   (Frontend)    │ ◄─────────────────────────────  │   (Backend)          │
└─────────────────┘         JSON Response          └──────────┬───────────┘
                                                              │
                                          ┌───────────────────┼───────────────────┐
                                          │                   │                   │
                                          ▼                   ▼                   ▼
                                   ┌─────────────┐   ┌──────────────┐   ┌───────────────┐
                                   │ PostgreSQL  │   │ File Storage │   │  BetterAuth   │
                                   │ (Docker)    │   │    (TBD)     │   │  JWT Session  │
                                   └─────────────┘   └──────────────┘   └───────────────┘
```

---

## Deployment

| Component    | Method         | Status     | Notes                          |
|--------------|----------------|------------|--------------------------------|
| PostgreSQL   | Docker         | Confirmed  | Containerized database         |
| NestJS API   | TBD            | Pending    | Docker recommended             |
| React SPA    | TBD            | Pending    | Static hosting or Docker       |
| Reverse Proxy| TBD            | Pending    | Nginx recommended              |
| File Storage | TBD            | Pending    | Local volume or object storage |

> Single environment — no dev/staging/production separation currently planned.

---

## Backend Architecture

### Layer Responsibilities

```
HTTP Request
     │
     ▼
┌─────────────┐
│   Guards    │  Authentication (JWT), Authorization (Role check)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Controllers │  Route handling, request parsing, response mapping only
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Services   │  All business logic lives here
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Prisma    │  Database access layer
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │
└──────┬──────┘
```

**Rules:**
- Controllers never call Prisma directly
- Services never handle HTTP concerns (status codes, headers)
- Guards are the only place that checks identity and role
- Common logic (logging, error formatting) handled by Interceptors and Filters in `common/`

---

## Authentication & Authorization

### Authentication
- Provider: **BetterAuth**
- Token type: **JWT**
- Flow: Client sends credentials → API validates → returns JWT → client attaches to every request via `Authorization: Bearer <token>`

### Roles & Permissions

| Role                        | Thai Name               | Typical Access Scope                          |
|-----------------------------|-------------------------|-----------------------------------------------|
| `ADMIN`                     | ผู้ดูแลระบบ             | Technical management, user accounts, master data (*No operational role in borrow/return, extensions, or transfers*) |
| `MANAGER`                   | ผู้บริหาร               | Read-only reports, dashboards, and audit data |
| `PARCEL_STAFF`              | เจ้าหน้าที่พัสดุ         | Asset registration, direct transfers, procurement, disposal |
| `ASSET_CENTER_STAFF`        | เจ้าหน้าที่ศูนย์ครุภัณฑ์ | Asset tracking, borrow approvals, desk/online extensions, handovers, returns, transfers |
| `DEPARTMENT_STAFF`          | เจ้าหน้าที่หน่วยงาน     | Self-service borrow, return pickup request, online extension requests (own department scope) |
| `MAINTENANCE_HEAD`          | หัวหน้าช่างซ่อมบำรุง    | Repair triage, technician assignment/dispatch, workload balancing, self-assignment |
| `MAINTENANCE_STAFF`         | ช่างซ่อมบำรุง            | Repair tickets, maintenance diagnosis & execution, spare parts requisition |

- Role is attached to JWT payload
- A `RolesGuard` checks role on each protected route via `@Roles()` decorator
- Permission is role-based (RBAC) — **`ADMIN` role is strictly restricted from performing operational business transactions** (e.g. creating/approving borrowings, extending borrow periods, or direct asset transfers)

### Password & Session Management
- **Self-Service Change Password (`POST /auth/change-password`)**:
  - Requires the current password and the new password.
  - Automatically revokes other active sessions (`revokeOtherSessions: true` is hardcoded for safety) to log out other devices.
- **Admin Reset Password (`PATCH /users/:id/reset-password`)**:
  - Restricted to the `ADMIN` role.
  - The admin sets a new password without needing the user's current password.
  - Revokes all active sessions for the target user by removing them directly from the `sessions` table in PostgreSQL via Prisma.

### Multi-Factor Authentication (2FA - TOTP) [Planned / Phase 2]
- **Mechanism**: Time-based One-Time Password (TOTP) via standard Authenticator Apps (Google Authenticator, Microsoft Authenticator).
- **Role Scoping**: Enforced or enabled strictly for high-privilege/high-risk administrative roles: `ADMIN`, `PARCEL_STAFF`, and `ASSET_CENTER_STAFF`. General department users (`DEPARTMENT_STAFF`) are exempted to maintain operational speed.

---

## Feature Modules

> Derived from domain requirements. Add modules here as the system grows.

| Module          | Responsibility                                                    |
|-----------------|-------------------------------------------------------------------|
| `auth`          | Login, logout, JWT issuance via BetterAuth, 2FA TOTP (Phase 2)    |
| `users`         | User accounts and role assignment                                 |
| `assets`        | Asset registration, status tracking, lost & disposal history, bulk e-GP CSV/XLSX sync (Phase 2) |
| `departments`   | Department/unit data that assets are assigned to                  |
| `transfers`     | Asset transfer between departments or locations                   |
| `borrowings`    | Borrow and return flow for department officers, wear-leveling smart recommendation (Phase 2) |
| `maintenance`   | Repair requests, technician assignments, maintenance history, repair viability analysis (Phase 2) |
| `spare-parts`   | Spare parts inventory, tracking and requisition                   |
| `audits`        | Physical asset counting and system data comparison                |
| `files`         | File upload and retrieval for asset documents and images          |
| `reports`       | Aggregated data views for executives and supply officers          |
| `common`        | Guards, interceptors, filters, decorators shared across modules   |

---

## Data Flow Examples

### 1. Borrowing & Return Flow with Expected Due Date

```
DEPARTMENT_STAFF (Self-Service)               ASSET_CENTER_STAFF
       │                                              │
       │  POST /api/v1/borrowings                     │
       │  (assetId, expectedReturnDate, method)       │
       ▼                                              │
  BorrowingsService                                   │
    - validate asset is AVAILABLE                     │
    - create BorrowTransaction (PENDING_APPROVE)      │
    - update asset status → RESERVED                  │
       │                                              │
       │ ◄────────── แจ้งเตือนคำขอเข้าศูนย์ ────────────┤
       │                                              │
       │                                              ▼
       │                                         PATCH /borrowings/:id/approve
       │                                         (approved_at, asset remains RESERVED)
       │                                              │
       │                                              ▼
       │                                         PATCH /borrowings/:id/handover
       │                                         - status → BORROWED
       │                                         - handover_date = NOW()
       │                                         - start counting till expected_return_date
       ▼                                              ▼
  PrismaService (Atomic Transaction) ────────────► PostgreSQL
```

---

### 2. Borrow Extension Flows (Sub-Resource RESTful Architecture)

#### Flow A: Desk Direct Extension (ต่อที่เคาน์เตอร์ศูนย์ฯ โดยตรง)
```
ASSET_CENTER_STAFF (ศูนย์ครุภัณฑ์เท่านั้น — ADMIN ไม่เกี่ยวข้อง)
       │
       │  POST /api/v1/borrowings/:id/extensions
       │  Body: { type: "DESK", requestedReturnDate, reason }
       ▼
  BorrowExtensionService
    - validate borrowing is BORROWED
    - validate requestedReturnDate > current expected_return_date
    - create BorrowExtension (status: APPROVED, approved_by_user_id = session.user.id)
    - update BorrowTransaction (expected_return_date = requestedReturnDate)
       │
       ▼
  PrismaService (Atomic Transaction) ──► PostgreSQL
```

#### Flow B: Online Extension Request & Approval (ขอต่อเวลาออนไลน์)
```
DEPARTMENT_STAFF                               ASSET_CENTER_STAFF
       │                                              │
       │  POST /api/v1/borrowings/:id/extensions      │
       │  Body: { type: "ONLINE",                     │
       │          requestedReturnDate, reason }       │
       ▼                                              │
  BorrowExtensionService                              │
    - validate borrowing is BORROWED                  │
    - validate no pending extension exists            │
    - create BorrowExtension (status: PENDING)        │
       │                                              │
       │ ◄─────── แจ้งเตือนคำขอต่อเวลาเข้าศูนย์ ──────────┤
       │                                              │
       │                                              ▼
       │                                         PATCH /api/v1/borrowing-extensions/:extensionId
       │                                         Body: { status: "APPROVED" }
       │                                         - update BorrowExtension (APPROVED, approved_at)
       │                                         - update BorrowTransaction (expected_return_date)
       ▼                                              ▼
  PrismaService (Atomic Transaction) ────────────► PostgreSQL
```

---

### 3. Direct Asset Transfer (โอนย้ายทันที ไม่ต้องรอ Approve พร้อมแนบเอกสาร)

```
PARCEL_STAFF / ASSET_CENTER_STAFF (ADMIN ไม่เกี่ยวข้อง)
       │
       │  POST /api/v1/transfers
       │  Body: {
       │    assetId: "...",
       │    transferDocNo: "DOC-TR-2026-001",
       │    transferDocUrl: "https://.../doc.pdf",
       │    transferDate: "2026-09-05T00:00:00Z",
       │    toSectionId: "section-uuid-2",
       │    toLocation: "ห้องตรวจ 102 อาคาร B",
       │    remark: "ย้ายเพื่อรองรับงานแผนกใหม่"
       │  }
       ▼
  TransfersService
    - validate asset exists and status allows transfer (NOT BORROWED, NOT DISPOSED)
    - validate target section exists
    - execute Prisma Transaction:
        1. asset.update({
             where: { id: assetId },
             data: { section_id: toSectionId, location: toLocation }
           })
        2. transfer.create({
             data: {
               asset_id: assetId,
               transferDocNo,
               transferDocUrl,
               transferDate,
               from_section_id: currentSectionId,
               to_section_id: toSectionId,
               fromLocation: currentLocation,
               toLocation,
               transferred_by_user_id: session.user.id,
               remark
             }
           })
       ▼
  PostgreSQL (Directly updated & Transfer History Audit Log created)
```

---

### 4. Repair Triage, Dispatch & Workload Balance Flow

```
DEPARTMENT_STAFF                   MAINTENANCE_HEAD                     MAINTENANCE_STAFF
       │                                  │                                     │
       │ POST /api/v1/repairs             │                                     │
       │ (assetId, symptom, urgency)      │                                     │
       ▼                                  │                                     │
  RepairsService                          │                                     │
    - create Job (status: PENDING_ASSIGN) │                                     │
    - asset status → UNDER_REPAIR         │                                     │
       │                                  │                                     │
       │ ──────── แจ้งเตือนงานแจ้งซ่อมใหม่ ──►│                                     │
       │                                  │ GET /repairs/mechanic-workloads     │
       │                                  │ (คำนวณภาระงานคงค้างของช่างแต่ละคน)      │
       │                                  │                                     │
       │                                  │ POST /repairs/:id/assign            │
       │                                  │ (techCategoryId, mechanicIds[])     │
       │                                  ▼                                     │
       │                             RepairsService                             │
       │                               - create MechanicRepair[] (1+ คน)        │
       │                               - job status → IN_PROGRESS               │
       │                                  │                                     │
       │                                  │ ──────── มอบหมายงานเข้าคิวช่าง ────────►│
       ▼                                  ▼                                     ▼
  PrismaService (Atomic Transaction) ────────────────────────────────────────► PostgreSQL
```

---

### 5. Mixed Spare Parts Requisition & Batch Handover Flow (`WITH_PARTS`)

```
MAINTENANCE_STAFF                       PARCEL_STAFF
       │                                     │
       │ PATCH /repairs/:id/diagnose         │
       │ (diagnosis, causeId,                │
       │  stepActionType: "WITH_PARTS",      │
       │  items: [                           │
       │    { sparepartId, qty,              │
       │      stockType: "INTERNAL" },       │
       │    { sparepartId, qty,              │
       │      stockType: "EXTERNAL" }        │
       │  ])                                 │
       ▼                                     │
  RepairsService                             │
    - if any stockType == 'EXTERNAL':        │
        job status → WAITING_PARTS           │
    - else: job status → IN_PROGRESS         │
       │                                     │
       │ ──────── แจ้งเตือนรายการเบิกพัสดุ ────────►│
       │                                     │ 1. เตรียมของ:
       │                                     │    - จัดเตรียมอะไหล่ INTERNAL ใส่เซ็ตรอ
       │                                     │    - สั่งซื้ออะไหล่ EXTERNAL
       │                                     │ 2. ของ EXTERNAL มาส่งถึง:
       │                                     │    - รับเข้าคลัง: create SparepartAdd
       │                                     │    - รวมเซ็ตครบชุด ➔ แจ้งช่างมารับของ
       │                                     │
       │ ◄─────── แจ้งช่าง: อะไหล่ครบชุดพร้อมจ่าย ──────┤
       │                                     │
       │ [Batch Handover ณ ห้องพัสดุ]          │
       │ กดยืนยันรับมอบอะไหล่ครบชุด (Step 7)      │
       ▼                                     │
  RepairsService                             │
    - บันทึก timestamp รับมอบรอบเดียว (Step 7)  │
    - สร้าง SparepartTxn (WITHDRAW) ทุกชิ้น    │
      พร้อมกันใน transaction เดียว            │
    - job status → IN_PROGRESS               │
       ▼                                     ▼
  PrismaService (Atomic Transaction) ───► PostgreSQL
```

---

### 6. Unrepairable Custody Handshake & Direct Asset Disposal Flow

```
MAINTENANCE_STAFF                       PARCEL_STAFF
       │                                     │
       │ 1. ตรวจพบว่าซ่อมไม่คุ้ม / ชำรุดหนัก         │
       │    PATCH /repairs/:id/diagnose      │
       │    (stepActionType: "UNREPAIRABLE", │
       │     diagnosis, unrepairableReason)  │
       ▼                                     │
  RepairsService                             │
    - job status → UNREPAIRABLE              │
    - asset status remains UNDER_REPAIR      │
       │                                     │
       │ ──── นำเครื่องจริงส่งมอบที่ห้องพัสดุ ────►│
       │                                     │ 2. พัสดุตรวจรับเครื่องเข้าคลังพัก:
       │                                     │    PATCH /repairs/:id/complete-unrepairable
       │                                     ▼
       │                               RepairsService
       │                                 - job status → COMPLETED
       │                                 - asset status → WAIT_DISPOSAL
       │                                 - received_by_user_id = parcelStaff.id
       │                                     │
       │                                     │ 3. ทำรายการจำหน่าย (Direct Disposal):
       │                                     │    POST /api/v1/disposals
       │                                     │    (assetId, disposalDocNo, docUrl, method)
       │                                     ▼
       │                               DisposalsService
       │                                 - asset status → DISPOSED
       │                                 - availability → UNAVAILABLE
       │                                 - create AssetDisposal audit record
       ▼                                     ▼
  PrismaService (Atomic Transaction) ───► PostgreSQL
```

---

## File Storage

- Used for: asset images, procurement documents, repair records
- Strategy: **TBD** (options: local Docker volume, MinIO, or cloud object storage)
- Files referenced in database by URL or path — not stored as blobs in PostgreSQL
- Upload/download handled through `files` module
- Access should be protected — files served only to authenticated users

---

## Cross-Cutting Concerns

| Concern         | Approach                                                       |
|-----------------|----------------------------------------------------------------|
| Error handling  | Global `HttpExceptionFilter` in `common/filters/`              |
| Logging         | NestJS built-in Logger, per-service logging                    |
| Validation      | `ValidationPipe` globally applied, class-validator on all DTOs |
| Serialization   | `ClassSerializerInterceptor` to strip sensitive fields         |
| CORS            | Enabled for React frontend origin only                         |
| API Docs        | Swagger via `@nestjs/swagger`, available at `/api/docs`        |

---

## Key Constraints

- Single hospital — no multi-tenancy required
- No external system integrations (no HIS, no LDAP/AD)
- No real-time features required at this stage (no WebSocket/SSE)
- Single deployment environment — no environment separation

---

## TBD

- Deployment target for API and frontend (VPS, cloud, on-premise)
- Reverse proxy setup (Nginx recommended)
- File storage strategy (local volume vs MinIO vs cloud)
- JWT expiry and refresh token strategy
- Database backup and recovery plan
- Whether Swagger UI should be disabled in production
