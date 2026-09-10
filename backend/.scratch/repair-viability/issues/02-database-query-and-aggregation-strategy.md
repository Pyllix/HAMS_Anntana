# Database Query and Aggregation Strategy

Type: research
Status: resolved
Blocked by: none

## Question

How should cumulative repair costs (`repairCost + SUM(sparepartTxn.qty * unitPrice)`) and repair counts/frequencies be queried across assets with pagination, sorting (e.g. sort by highest repair cost ratio or oldest asset), and status filtering in PostgreSQL & Prisma? Specifically, can this be achieved efficiently in a single query via raw SQL (`prisma.$queryRaw`) or Prisma relation aggregations without causing N+1 performance bottlenecks?

## Answer

### 1. Architectural Decision: Hybrid Query Architecture

Adopt a **Hybrid Query Strategy** that leverages the strengths of both PostgreSQL raw aggregation and Prisma ORM type safety:

- **List & Audit Filtering (`GET /assets/viability`):**  
  Implemented via a **PostgreSQL CTE query with `prisma.$queryRaw`**.
  - **Reasoning:** Computing virtual fields (such as `cumulative_repair_cost`, `cost_ratio`, `recent_repair_count`, and `viability_status`) across all assets must happen on the database engine to allow server-side filtering (e.g., `WHERE viability_status = 'UNVIABLE'`), pagination, and sorting (e.g., `ORDER BY cost_ratio DESC`). A pure Prisma `findMany` cannot sort or filter across computed aggregations on unrelated tables.
  - **Performance & Zero N+1:** The query aggregates all past repair jobs and spare parts transactions (`WITHDRAW` - `RETURN`) into a single result set in one database roundtrip, utilizing existing indexes on `repair_job.asset_id`, `sparepart_txns.job_id`, and `asset.section_id`.
  - **KPI Cards in Single Roundtrip:** A companion aggregation query calculates summary counters (`total_evaluated`, `viable_count`, `warning_count`, `unviable_count`, `total_unviable_cost`) for the dashboard boxes.

- **Single Asset Deep-Dive (`GET /assets/:id/viability`):**  
  Implemented via **Prisma `findUnique`** with full nested relations (`repairJobs`, `sparepartTxns`, `type`, `section`, `company`).
  - **Reasoning:** Since this query inspects a single asset by ID, Prisma handles full object relational hydration cleanly and type-safely, providing an itemized breakdown of past repair jobs and spare parts for the modal card and frontend PDF report generation.

---

### 2. Standard SQL Aggregation Template (PostgreSQL CTE)

```sql
WITH repair_cost_per_job AS (
  SELECT 
    rj.job_id,
    rj.asset_id,
    rj.repair_cost,
    rj.created_at,
    COALESCE(SUM(
      CASE 
        WHEN st.txn_type = 'WITHDRAW' THEN st.qty * st.unit_price
        WHEN st.txn_type = 'RETURN' THEN - (st.qty * st.unit_price)
        ELSE 0 
      END
    ), 0) AS parts_cost
  FROM repair_job rj
  LEFT JOIN sparepart_txns st ON st.job_id = rj.job_id
  GROUP BY rj.job_id, rj.asset_id, rj.repair_cost, rj.created_at
),
asset_repair_summary AS (
  SELECT 
    asset_id,
    COUNT(job_id) AS total_repair_count,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 year' THEN 1 END) AS recent_repair_count,
    COALESCE(SUM(COALESCE(repair_cost, 0) + parts_cost), 0) AS cumulative_repair_cost
  FROM repair_cost_per_job
  GROUP BY asset_id
)
SELECT 
  a.asset_id,
  a.noid,
  a.name,
  a.model,
  a.price,
  a.receive_date,
  a.warranty_date,
  t.name AS asset_type_name,
  COALESCE(t.useful_life, 8) AS useful_life_years,
  s.name AS section_name,
  ast.code AS asset_status_code,
  COALESCE(ars.total_repair_count, 0) AS total_repair_count,
  COALESCE(ars.recent_repair_count, 0) AS recent_repair_count,
  COALESCE(ars.cumulative_repair_cost, 0) AS cumulative_repair_cost
FROM asset a
LEFT JOIN asset_repair_summary ars ON ars.asset_id = a.asset_id
LEFT JOIN asset_type t ON t.asset_type_id = a.type_id
LEFT JOIN section s ON s.section_id = a.section_id
LEFT JOIN asset_status ast ON ast.asset_status_id = a.asset_status_id;
```

