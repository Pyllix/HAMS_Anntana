# Database Query & Borrow Metrics Aggregation

Type: research
Status: resolved
Blocked by: none

## Question

How should past borrow durations (`return_date - handover_date`) within the 90-day window and the latest return date (`MAX(return_date)`) be queried efficiently in PostgreSQL & Prisma for all available assets of a given model, avoiding N+1 roundtrips and leveraging indexes?

## Answer

### 1. Database Query Architecture

Implemented using a single **PostgreSQL CTE via `prisma.$queryRaw`**:
- Utilizes the existing B-Tree index on `borrow_transaction.asset_id` (`@@index([asset_id])`).
- Limits the aggregation to candidate assets that meet the availability criteria (`ast.code = 'NORMAL'` AND `avs.code = 'AVAILABLE'`).
- Calculates `usage_days_90d` using timestamp epoch differences clamped to the 90-day window.
- Calculates `idle_days` using `MAX(bt.return_date)` (or falling back to `a.receive_date`).
- Performs server-side deterministic sorting (`ORDER BY usage_days_90d ASC, idle_days DESC, borrow_count_90d ASC, ca.noid ASC`) in a single query execution.

### 2. Standard SQL Query

```sql
WITH candidate_assets AS (
  SELECT 
    a.asset_id,
    a.noid,
    a.name,
    a.model,
    a.serial_no,
    a.receive_date,
    a.image_url,
    s.name AS section_name
  FROM asset a
  JOIN asset_status ast ON ast.asset_status_id = a.asset_status_id
  JOIN availability_status avs ON avs.availability_status_id = a.availability_status_id
  LEFT JOIN section s ON s.section_id = a.section_id
  WHERE a.model = $1
    AND ast.code = 'NORMAL'
    AND avs.code = 'AVAILABLE'
),
borrow_metrics_90d AS (
  SELECT 
    bt.asset_id,
    COUNT(bt.borrow_transaction_id) AS borrow_count_90d,
    MAX(bt.return_date) AS last_return_date,
    COALESCE(SUM(
      GREATEST(0, EXTRACT(EPOCH FROM (
        LEAST(COALESCE(bt.return_date, NOW()), NOW()) - 
        GREATEST(COALESCE(bt.handover_date, bt.created_at), NOW() - INTERVAL '90 days')
      )) / 86400.0)
    ), 0) AS usage_days_90d
  FROM borrow_transaction bt
  JOIN candidate_assets ca ON ca.asset_id = bt.asset_id
  WHERE (bt.return_date >= NOW() - INTERVAL '90 days' 
     OR bt.handover_date >= NOW() - INTERVAL '90 days'
     OR bt.created_at >= NOW() - INTERVAL '90 days')
  GROUP BY bt.asset_id
)
SELECT 
  ca.*,
  COALESCE(bm.usage_days_90d, 0) AS usage_days_90d,
  COALESCE(bm.borrow_count_90d, 0) AS borrow_count_90d,
  bm.last_return_date,
  GREATEST(0, EXTRACT(EPOCH FROM (
    NOW() - COALESCE(bm.last_return_date, ca.receive_date, NOW())
  )) / 86400.0) AS idle_days
FROM candidate_assets ca
LEFT JOIN borrow_metrics_90d bm ON bm.asset_id = ca.asset_id
ORDER BY 
  usage_days_90d ASC,
  idle_days DESC,
  borrow_count_90d ASC,
  ca.noid ASC;
```

