# Copilot Instructions

This is a **NestJS REST API** backend for a Hospital Asset Management System
(ระบบจัดการครุภัณฑ์โรงพยาบาล). It serves a React SPA frontend.

## Stack

- **Runtime**: Node.js + TypeScript (strict mode)
- **Framework**: NestJS (feature-based module structure)
- **ORM**: Prisma
- **Database**: PostgreSQL (Docker)
- **Auth**: BetterAuth with JWT
- **Testing**: Jest (unit) + Supertest (E2E)
- **Linting/Formatting**: ESLint + Prettier

## Project Layout

```
src/
├── main.ts                  # Bootstrap only
├── app.module.ts
├── common/                  # Guards, interceptors, filters, decorators, pipes
├── config/                  # Environment config and validation
├── prisma/                  # PrismaService
└── [feature]/               # assets, users, departments, transfers, borrowings,
                             # maintenance, disposals, files, reports, auth
    ├── dto/
    ├── entities/
    ├── [feature].controller.ts
    ├── [feature].service.ts
    ├── [feature].module.ts
    └── [feature].controller.spec.ts
```

## Architecture Rules

- Controllers handle HTTP only — no business logic
- Services own all business logic — never import PrismaClient directly, always inject PrismaService
- Guards are the only place that checks JWT identity and role
- Never return raw Prisma models from controllers — always map to a response DTO
- Use `select` in Prisma queries to limit returned fields

## Code Conventions

- All files: kebab-case (`asset-transfer.service.ts`)
- Classes: PascalCase; variables/functions: camelCase; constants: UPPER_SNAKE_CASE
- Always use `async/await` — never `.then()/.catch()`
- No `any` — use `unknown` and narrow explicitly
- Explicit return types on all service methods and controllers
- Use `@ApiTags`, `@ApiOperation`, `@ApiResponse` on every controller (Swagger)
- Use class-validator decorators on every DTO
- Use NestJS `HttpException` subclasses for errors (`NotFoundException`, `ForbiddenException`, etc.)

## API Conventions

- Base path: `/api/v1`
- Plural nouns: `/assets`, `/users`, `/departments`
- Prefer `PATCH` over `PUT`
- Pagination via query params: `?page=1&limit=20`

## Roles (RBAC)

| Enum                   | Thai Name                    |
|------------------------|------------------------------|
| `ADMIN`                | ผู้ดูแลระบบ                  |
| `EXECUTIVE`            | ผู้บริหาร                    |
| `SUPPLY_OFFICER`       | เจ้าหน้าที่พัสดุ              |
| `ASSET_CENTER_OFFICER` | เจ้าหน้าที่ศูนย์ครุภัณฑ์      |
| `DEPARTMENT_OFFICER`   | เจ้าหน้าที่หน่วยงาน (คนยืม)  |
| `TECHNICIAN`           | ช่าง                         |

Use `@Roles()` decorator + `RolesGuard` on protected routes. Role is read from JWT payload.

## Testing

- Unit tests: mock PrismaService — never use a real database
- Place `.spec.ts` beside the source file
- E2E tests: in `test/` at project root

## Hard Rules

- Never hardcode secrets or credentials — use environment variables only
- Never edit Prisma migration files after generation
- Never disable ESLint rules globally
- Never place logic in `main.ts` beyond bootstrapping
- Never access `req.body` directly — always go through DTOs
