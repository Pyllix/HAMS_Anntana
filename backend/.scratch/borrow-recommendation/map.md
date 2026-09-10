## Destination

A complete, locked technical specification (`.scratch/borrow-recommendation/spec.md`) defining the Balanced Usage Rotation algorithm (90-day usage window + idle days), SQL/Prisma query design for borrow usage metrics, API contracts (`GET /borrowings/recommendations`, `GET /borrowings/recommendations/swap-check`), and frontend integration blueprints for Catalog Badges and Smart Swap Nudges, ready for implementation.

## Notes

- **Domain**: Hospital Asset & Maintenance System (HAMS), Medical Equipment Borrowing & Lending (`BorrowTransaction`, `Asset`, `AvailabilityStatus`).
- **Target Personas**: `DEPARTMENT_STAFF` (Self-service ward borrower), `ASSET_CENTER_STAFF` / `PARCEL_STAFF` (Desk-service operator), `MANAGER`.
- **Architecture Preferences**:
  - Grouping: Same model & equipment type (`model` + `equipment_type_id`) among `AVAILABLE` & `NORMAL` assets.
  - Ranking Algorithm: Balanced Usage Rotation (minimize 90-day usage days, maximize idle rest days).
  - UX: Dual integration (Catalog recommended badge + Smart Swap Nudge with `hasBetterAlternative` flag).
- **Standing skills**: `domain-modeling`, `codebase-design`, `tdd`.

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [Grouping Boundary](CONTEXT.md) — Grouping candidate assets by same `model` and `equipment_type_id`, restricted to `AVAILABLE` and `NORMAL` status.
- [Rotation Algorithm](CONTEXT.md) — Balanced Usage Rotation: 90-day usage window prioritized by least borrowed days, broken by longest idle days.
- [UX & API Strategy](CONTEXT.md) — Dual integration: Catalog recommendation ranking + Smart Swap Nudge with pre-computed `hasBetterAlternative` payload.
- [Rotation Algorithm and Scoring Formula](issues/01-rotation-algorithm-and-scoring-formula.md) — Formulated 4-tier sorting hierarchy (usageDays90d ASC -> idleDays DESC -> borrowCount90d ASC -> noid ASC), 3-day delta swap threshold, and Thai rationale strings.
- [Database Query & Borrow Metrics Aggregation](issues/02-database-query-and-borrow-metrics-aggregation.md) — Implemented PostgreSQL CTE query calculating 90-day usage window and idle days with Zero N+1 roundtrips.
- [API Contract & DTO Design for Recommendations & Smart Swap](issues/03-api-contract-and-dto-design.md) — Defined contracts for `GET /borrowings/recommendations` and `GET /borrowings/recommendations/swap-check`.
- [Frontend Integration Blueprint & Concurrency Handling](issues/04-frontend-integration-and-concurrency.md) — Designed React UI snippets for Smart Swap Alert banner, state switching, and 409 Conflict fallback recovery.
- [Compile Technical Specification](issues/05-compile-technical-specification.md) — **DESTINATION REACHED:** Synthesized all decisions into the authoritative technical specification at [spec.md](spec.md). Fully prepared for code implementation.

## Not yet specified

- Reservation time-slot lookahead (considering upcoming approved bookings in the future).
- Battery health / cycle count integration (for mobile battery-powered equipment).
- Inter-ward distance / proximity optimization (recommending the machine physically closest to the requesting ward).

## Out of scope

- Mandatory / Forced equipment assignment (the borrower or staff maintains autonomy to override the recommendation if clinical circumstances require).
- Multi-asset batch borrowing recommendation (single equipment recommendation focus for Phase 2).
