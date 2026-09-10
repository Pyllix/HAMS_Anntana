## Destination

A complete, locked technical specification (`.scratch/repair-viability/spec.md`) defining the Rule-based Decision Tree for repair economic viability, PostgreSQL query/aggregation design, API contracts (`GET /assets/viability`, `GET /assets/:id/viability`), and integration hooks with the `/disposals` module, ready for implementation.

## Notes

- **Domain**: Hospital Asset & Maintenance System (HAMS), Medical Equipment Maintenance & Condemnation/Disposal Procedures (อ้างอิง `docs/วิธีปฏิบัติการแทงจำหน่ายเครื่องมือแพทย์.pdf` รหัส EQM-WI-040).
- **Target Persona**: `PARCEL_STAFF` (เจ้าหน้าที่พัสดุเป็นผู้มีอำนาจตัดสินใจประเมินความคุ้มค่าและดำเนินการแทงจำหน่าย), `MAINTENANCE_HEAD` / `ADMIN` (ผู้ตรวจสอบร่วม).
- **Architecture Preferences**:
  - Backend provides structured JSON with audit calculations; Frontend handles PDF/report generation.
  - Decision model is Rule-based Decision Tree (Explainable to hospital committee).
  - Stand-alone service & controller under `src/asset/` or dedicated `src/asset-viability/`.
- **Standing skills**: `domain-modeling`, `codebase-design`, `tdd`.

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [Scope & Effort Separation](docs/agents/issue-tracker.md) — Separate efforts into `repair-viability` and `borrow-recommendation`; start with `repair-viability` first.
- [Persona & Entry Point](CONTEXT.md) — Dedicated audit view for `PARCEL_STAFF` to review before repair/disposal; Backend returns JSON, Frontend renders PDF.
- [Viability Decision Model](CONTEXT.md) — Rule-based Decision Tree with `VIABLE`, `WARNING`, and `UNVIABLE` based on cumulative repair cost ratio ($\ge 70\%$), useful life expiration, and repair frequency.
- [Viability Rule Tree & Edge Cases](issues/01-viability-rule-tree-and-edge-cases.md) — Established 6-tier precedence hierarchy, edge case fallbacks (0 price, active warranty, missing useful life), and explainable Thai reason messages.
- [Database Query and Aggregation Strategy](issues/02-database-query-and-aggregation-strategy.md) — Adopted Hybrid Query Architecture: PostgreSQL CTE via `prisma.$queryRaw` for list/sorting/filtering with Zero N+1, plus Prisma `findUnique` for single asset deep dives.
- [API Contract & DTO Design](issues/03-api-contract-and-dto-design.md) — Designed endpoints `GET /assets/viability` (with KPI counters, filters, sorting, pagination) and `GET /assets/:id/viability` (single-asset deep dive and PDF export source).
- [Disposal Action Handshake](issues/04-disposal-action-handshake.md) — Defined pre-disposal guards (blocking borrowed assets, routing ongoing repairs to UNREPAIRABLE handshake), auto-excluding disposed assets, and pre-filling disposal reasons.
- [Compile Technical Specification](issues/05-compile-technical-specification.md) — **DESTINATION REACHED:** Synthesized all decisions into the authoritative technical specification at [spec.md](spec.md). Fully prepared for code implementation.

## Not yet specified

- Dynamic threshold configuration (System settings table for adjusting 50% and 70% thresholds in DB instead of constants).
- Advanced straight-line depreciation accounting (คำนวณมูลค่าคงเหลือทางบัญชี Net Book Value).
- Machine learning / predictive failure modeling for proactive maintenance.
- Follow-up effort: `borrow-recommendation` (Smart Asset Borrow Recommendation Engine to balance asset wear-and-tear across equivalent equipment).

## Out of scope

- Backend PDF report generation (Frontend handles client-side PDF rendering).
- Automatic disposal execution without human confirmation (Must go through `PARCEL_STAFF` approval flow).
