# AGENT.md

> This file guides AI agents and developers working on this codebase.
> **CRITICAL RULE FOR ALL AI AGENTS:** You MUST read all `.md` files at the root of this project (e.g., `AGENT.md`, `ARCHITECTURE.md`, `CONTEXT.md`, `README.md`) using your `view_file` tool *every time* before starting any task, to ensure full context awareness.
> Follow all rules here unless explicitly overridden in a task-specific instruction.

---

## Project Overview

REST API backend for a **Hospital Asset Management System** (ระบบจัดการครุภัณฑ์โรงพยาบาล).
Serves a web frontend for tracking, managing, and auditing physical assets within a hospital.

---

## Technology Stack

| Concern      | Technology          | Status    |
|--------------|---------------------|-----------|
| Runtime      | Node.js             | Confirmed |
| Language     | TypeScript          | Confirmed |
| Framework    | NestJS              | Confirmed |
| ORM          | Prisma              | Confirmed |
| Database     | PostgreSQL          | Confirmed |
| Auth         | BetterAuth          | Confirmed |
| Testing      | Jest + Supertest    | Confirmed |
| Linter       | ESLint              | Confirmed |
| Formatter    | Prettier            | Confirmed |

> Additional technologies may be added. Update this table when confirmed.

---

## Project Structure

Feature-based structure. Each feature is self-contained.

```
src/
├── main.ts
├── app.module.ts
├── common/                  # Shared utilities, guards, decorators, pipes
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── config/                  # Environment config and validation
├── prisma/                  # PrismaService and schema
└── [feature]/               # e.g. assets/, users/, departments/
    ├── dto/
    ├── entities/
    ├── [feature].controller.ts
    ├── [feature].service.ts
    ├── [feature].module.ts
    └── [feature].controller.spec.ts
```

**Rules:**
- Never place business logic in controllers — controllers handle HTTP only
- Services own all business logic
- DTOs live inside the feature folder, not a global `dto/` folder
- Shared logic goes in `common/` only if used by 2+ features

---

## Code Conventions

### Naming
| Subject              | Convention         | Example                        |
|----------------------|--------------------|--------------------------------|
| Files                | kebab-case         | `asset-transfer.service.ts`    |
| Classes              | PascalCase         | `AssetTransferService`         |
| Variables/Functions  | camelCase          | `findAssetById()`              |
| Constants            | UPPER_SNAKE_CASE   | `MAX_ASSET_PER_ROOM`           |
| Enums                | PascalCase         | `AssetStatus.ACTIVE`           |
| Database tables      | snake_case         | `asset_transfers`              |
| DTO properties       | camelCase          | `serialNumber`                 |
| Environment vars     | UPPER_SNAKE_CASE   | `DATABASE_URL`                 |

### TypeScript
- **Always** use explicit return types on service methods and controllers
- **No** `any` — use `unknown` and narrow types explicitly
- Use `readonly` on DTO properties where mutation is not needed
- Prefer `interface` for shapes, `type` for unions/intersections
- Enable strict mode — do not disable strictness flags

### Async
- Always use `async/await` — never `.then()/.catch()` chains
- Always handle errors with `try/catch` or NestJS exception filters

### NestJS Specific
- Use `@ApiTags`, `@ApiOperation`, `@ApiResponse` on all controllers (Swagger)
- Use class-validator decorators on all DTOs (`@IsString()`, `@IsUUID()`, etc.)
- Use `@Injectable()` and constructor injection — never manual instantiation
- Never import `PrismaClient` directly — always inject `PrismaService`
- Use NestJS built-in `HttpException` subclasses for errors (e.g. `NotFoundException`)

### Prisma
- Never write raw SQL unless there is no Prisma equivalent
- All schema changes go through migrations — never edit the database directly
- Never commit migration files that have been manually edited after generation
- Use `select` to limit fields returned — avoid returning full models with sensitive data

### Security
- Never hardcode secrets, tokens, or credentials
- All secrets via environment variables only
- Validate all incoming data with DTOs + class-validator before it reaches services
- Auth guard must be applied at controller or route level — never rely on frontend-only checks

---

## API Conventions

- Base path: `/api/v1`
- Response format (success):
```json
{
  "data": {},
  "message": "success",
  "statusCode": 200
}
```
- Response format (error):
```json
{
  "statusCode": 404,
  "message": "Asset not found",
  "error": "Not Found"
}
```
- Use plural nouns for resource paths: `/assets`, `/departments`, `/users`
- Use HTTP verbs correctly: `GET` read, `POST` create, `PATCH` partial update, `DELETE` remove
- Prefer `PATCH` over `PUT`
- Use query params for filtering/pagination: `?page=1&limit=20&status=ACTIVE`

---

## Pagination

All list endpoints **must** use the shared pagination utilities in `src/common/`.

### Query Parameters
| Param    | Type     | Default | Constraint    | Description                        |
|----------|----------|---------|---------------|------------------------------------|
| `page`   | `number` | `1`     | min 1         | Page number (1-based)              |
| `limit`  | `number` | `20`    | min 1, max 100| Items per page                     |
| `search` | `string` | —       | optional      | Keyword filter (case-insensitive)  |

### Response Shape
Every paginated endpoint returns:
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

### Shared Files
| File | Purpose |
|------|---------|
| `src/common/dto/pagination.dto.ts` | Validated query DTO (`page`, `limit`, `search`) |
| `src/common/utils/paginate.util.ts` | `paginate(data, total, page, limit)` helper |

### Implementation Pattern
```ts
// service
async findAll(query: PaginationDto): Promise<PaginatedResult<T>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = { deletedAt: null, /* optional search filter */ };

  const [data, total] = await this.prisma.$transaction([
    this.prisma.model.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    this.prisma.model.count({ where }),
  ]);

  return paginate(data, total, page, limit);
}

// controller
@Get()
findAll(@Query() query: PaginationDto) {
  return this.service.findAll(query);
}
```

### Rules
- Always use `$transaction([findMany, count])` to get data and total in one round-trip
- Never return raw arrays from list endpoints — always wrap with `paginate()`
- Use `@ApiQuery` on controller for each param to document in Swagger
- Add `search` filter with `{ contains: ..., mode: 'insensitive' }` on relevant text fields

---

## Testing

- **Unit tests**: one `.spec.ts` per service file, placed beside the source file
- **E2E tests**: in `test/` folder at project root
- Use `Jest` for unit, `Supertest` for E2E
- Mock `PrismaService` in unit tests — never use real database in unit tests
- Aim for coverage on: all service methods, all guard logic, all DTO validation
- Test file naming: `[feature].service.spec.ts`, `[feature].controller.spec.ts`

```ts
// Example: always mock PrismaService
const mockPrismaService = {
  asset: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};
```

---

## Git Conventions

### Branch Naming
```
feat/[short-description]      # New feature
fix/[short-description]       # Bug fix
chore/[short-description]     # Maintenance, deps, config
refactor/[short-description]  # Refactor without behavior change
```

### Commit Messages — Conventional Commits
```
feat(assets): add asset transfer endpoint
fix(auth): resolve token expiry not refreshing
chore(deps): update prisma to 5.x
refactor(users): extract permission check to guard
```

- Scope is the feature name in lowercase
- Subject line max 72 characters
- Use imperative tense: "add" not "added"

---

## What NOT To Do

- ❌ Do not place logic in `main.ts` beyond bootstrapping
- ❌ Do not bypass DTOs and access `req.body` directly
- ❌ Do not use `@ts-ignore` or `@ts-expect-error` without a comment explaining why
- ❌ Do not create God services — split by responsibility
- ❌ Do not edit Prisma migration files after they are generated
- ❌ Do not return Prisma model objects directly from controllers — always map to response DTO
- ❌ Do not disable ESLint rules globally
- ❌ **Do not allow `ADMIN` role to execute operational transactions**: `ADMIN` is strictly for user management, system configs, and Master Data. Never add `UserRole.ADMIN` to operational endpoints such as borrow approvals, handovers, returns, desk extensions, extension approvals, or direct asset transfers
- ❌ **Do not implement approval workflows for Asset Transfers**: Transfers are **Direct Transfers** (no pending approval steps) that atomically update `asset.section_id` and record immutable transfer document history
- ❌ **Do not omit `expectedReturnDate` in Borrowing creation**: All borrow requests must capture `expectedReturnDate` to ensure accurate overdue tracking and notification
- ❌ **Do not allow `MAINTENANCE_STAFF` to assign repair jobs to others**: Job assignment, triage, and technician dispatch are strictly reserved for `MAINTENANCE_HEAD` (though `MAINTENANCE_HEAD` can self-assign)
- ❌ **Do not split `INTERNAL_STOCK` and `EXTERNAL_STOCK` into separate tracks in `StepMaster`**: Always use the consolidated `WITH_PARTS` track with line-item `stockType: "INTERNAL" | "EXTERNAL"`
- ❌ **Do not record piecemeal/separate `SparepartTxn` (WITHDRAW) timestamps for mixed requisitions**: For `WITH_PARTS`, execute a **Batch Handover** where all parts (both in-stock and procured) have their withdrawal transactions created atomically in a single timestamp when the technician confirms physical receipt (Step 7), ensuring a clean and auditable trail
- ❌ **Do not skip the parcel staff custody acceptance step for `UNREPAIRABLE` cases**: When a repair is deemed unrepairable, the technician submits the finding, but the asset status is updated to `WAIT_DISPOSAL` and the job is closed only when `PARCEL_STAFF` confirms physical receipt (`complete-unrepairable`)
- ❌ **Do not create multi-step approval workflows for Asset Disposals**: Disposals are **Direct Disposals** executed directly by `PARCEL_STAFF`, atomically updating `asset.asset_status_id = DISPOSED`, `availability_status_id = UNAVAILABLE`, and creating an audit record in `AssetDisposal`
- ❌ **Do not auto-create Repair Jobs upon returning damaged assets**: When an asset is returned damaged (`RETURNED_DAMAGED`), update `asset.asset_status_id = DAMAGED` and `availability_status_id = UNAVAILABLE`. Do NOT automatically spawn a `RepairJob`; let `ASSET_CENTER_STAFF` or the ward manually file the repair ticket with proper symptom details.
- ❌ **Do not block online borrow extensions solely because the item is overdue**: Allow users to submit `POST /borrowings/:id/extensions` with type `ONLINE` even when `isOverdue: true`, pending `ASSET_CENTER_STAFF` review and approval.
- ❌ **Do not let technicians directly select external vendors for `OUTSOURCE` repairs**: Technicians diagnose and mark `stepActionType: "OUTSOURCE"`, but `PARCEL_STAFF` is responsible for selecting the vendor (`company_id`), managing quotations/POs, and coordinating with the vendor.
- ❌ **Do not allow technicians to directly execute stock return transactions**: Unused spare parts must be physically handed back to the warehouse, and `PARCEL_STAFF` records the return transaction (`SPAREPART_TXN` with `txn_type = "RETURN"`) into stock.

## TBD

- Deployment target (Docker / cloud provider)
- Background job / queue strategy (e.g. BullMQ)
- File upload strategy for asset documents/images
- Notification system (email / in-app)
- Role and permission model details
