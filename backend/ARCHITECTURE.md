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
└─────────────┘
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
| `ADMIN`                     | ผู้ดูแลระบบ             | Full system access, user management           |
| `MANAGER`                   | ผู้บริหาร               | Read-only reports and dashboards              |
| `PARCEL_STAFF`              | เจ้าหน้าที่พัสดุ         | Asset registration, procurement, disposal     |
| `ASSET_CENTER_STAFF`        | เจ้าหน้าที่ศูนย์ครุภัณฑ์ | Asset tracking, transfers, maintenance records|
| `DEPARTMENT_STAFF`          | เจ้าหน้าที่หน่วยงาน     | Borrow/return assets within their department  |
| `MAINTENANCE_STAFF`         | ช่างซ่อมบำรุง            | Repair records, maintenance tasks             |

- Role is attached to JWT payload
- A `RolesGuard` checks role on each protected route via `@Roles()` decorator
- Permission is role-based (RBAC) — no fine-grained permission flags at this stage

---

## Feature Modules

> Derived from domain requirements. Add modules here as the system grows.

| Module          | Responsibility                                                    |
|-----------------|-------------------------------------------------------------------|
| `auth`          | Login, logout, JWT issuance via BetterAuth                        |
| `users`         | User accounts and role assignment                                 |
| `assets`        | Asset registration, status tracking, lost & disposal history      |
| `departments`   | Department/unit data that assets are assigned to                  |
| `transfers`     | Asset transfer between departments or locations                   |
| `borrowings`    | Borrow and return flow for department officers                    |
| `maintenance`   | Repair requests, technician assignments, maintenance history      |
| `spare-parts`   | Spare parts inventory, tracking and requisition                   |
| `audits`        | Physical asset counting and system data comparison                |
| `files`         | File upload and retrieval for asset documents and images          |
| `reports`       | Aggregated data views for executives and supply officers          |
| `common`        | Guards, interceptors, filters, decorators shared across modules   |

---

## Data Flow Examples

### Borrowing an Asset

```
DEPARTMENT_STAFF
       │  POST /api/v1/borrowings
       ▼
  JwtAuthGuard → RolesGuard (DEPARTMENT_STAFF)
       │
       ▼
  BorrowingsController.create()
       │
       ▼
  BorrowingsService
    - validate asset is AVAILABLE
    - create borrowing record
    - update asset status → BORROWED
       │
       ▼
  PrismaService (transaction)
       │
       ▼
  PostgreSQL
```

### Asset Transfer

```
ASSET_CENTER_STAFF
       │  POST /api/v1/transfers
       ▼
  JwtAuthGuard → RolesGuard (ASSET_CENTER_STAFF, PARCEL_STAFF)
       │
       ▼
  TransfersController.create()
       │
       ▼
  TransfersService
    - validate asset exists and is transferable
    - create transfer record
    - update asset department assignment
       │
       ▼
  PrismaService (transaction)
       │
       ▼
  PostgreSQL
```

### Asset Status Change & History Recording

```
PARCEL_STAFF / ASSET_CENTER_STAFF
       │  PATCH /api/v1/asset/:id/status
       ▼
  JwtAuthGuard → RolesGuard
       │
       ▼
  AssetController.updateStatus()
       │
       ▼
  AssetService
    - validate asset exists
    - update asset.asset_status_id → new status
       │
       ▼
  PrismaService
       │
       ▼
  PostgreSQL

  ─── Then separately record history ───

  POST /api/v1/asset/:id/disposal
       ▼
  AssetService.createDisposal()
    - validate asset exists
    - create AssetDisposal record (disposal_status = PENDING_DISPOSAL, pendingReason, pendingAt)

  PATCH /api/v1/asset/:id/disposal/:disposalId
       ▼
  AssetService.completeDisposal()
    - validate disposal record exists and is PENDING
    - update AssetDisposal (disposal_status = DISPOSED, disposalReason, remark, disposedAt)
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
