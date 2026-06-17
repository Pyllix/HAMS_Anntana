# CONTEXT.md

## Project Overview
The Hospital Asset & Maintenance System (HAMS) is a centralized web application designed to manage hospital assets and maintenance workflows. It serves as a single source of truth to minimize data redundancy, track assets in real-time, and streamline processes ranging from borrowing equipment to tracking spare parts and repairs.

## Business Domain
- **Asset (ครุภัณฑ์)**: Physical equipment or property owned by the hospital managed within the system.
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