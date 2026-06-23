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

---

## TBD

- Deployment target (Docker / cloud provider)
- Background job / queue strategy (e.g. BullMQ)
- File upload strategy for asset documents/images
- Notification system (email / in-app)
- Role and permission model details
