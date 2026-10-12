# Spare part transaction history API

`GET /spare-parts/transactions` returns one row per recorded spare-part transaction. Rows are not grouped by repair job or spare part. A repair job with several parts therefore appears as several rows, and a later return is another row.

The endpoint keeps the existing cookie authentication and read roles: `ADMIN`, `MANAGER`, `PARCEL_STAFF`, `ASSET_CENTER_STAFF`, and `MAINTENANCE_STAFF`.

## Query parameters

| Parameter | Meaning |
| --- | --- |
| `page` | 1-based page number; defaults to `1`. |
| `limit` | Rows per page; defaults to `20`, maximum `100`. |
| `search` | Case-insensitive partial search across spare-part code, spare-part name, and repair job number. Whitespace-only input is treated as empty. |
| `txnType` | One of `WITHDRAW`, `RETURN`, `ADJUST`, or `PENDING_WITHDRAW`. When omitted, only `WITHDRAW` and `RETURN` are included; `PENDING_WITHDRAW` is not a completed withdrawal. |
| `startDate` | Inclusive calendar date `YYYY-MM-DD` in `Asia/Bangkok`, applied to `txnDate`. |
| `endDate` | Inclusive calendar date `YYYY-MM-DD` in `Asia/Bangkok`, applied to `txnDate`. Must not be before `startDate`. |
| `sparepartId` | Existing exact spare-part ID filter. |
| `jobId` | Existing exact repair-job UUID filter. |
| `userId` | Existing exact transaction actor UUID filter. |

All supplied filters apply together. Date bounds are converted to a half-open timestamp range from midnight on `startDate` through (but excluding) midnight after `endDate` in Bangkok time. Results sort by `txnDate` descending and then transaction `id` descending. The same filters determine both `data` and `meta.total` before pagination.

Invalid dates, unsupported `txnType` values, invalid IDs, and an inverted date range return HTTP 400.

## Response

```json
{
  "data": [
    {
      "id": 42,
      "txnType": "WITHDRAW",
      "stockType": "INTERNAL",
      "txnDate": "2026-08-31T10:00:00.000Z",
      "qty": 2,
      "sparepart": {
        "id": 3,
        "code": "FUSE-10A",
        "name": "Fuse 10A",
        "unit": "ชิ้น"
      },
      "repairJob": {
        "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "jobNo": "REP-001"
      },
      "user": {
        "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "name": "Somchai Jai Dee"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 36,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

`stockType` is `INTERNAL`, `EXTERNAL`, or `null` when no source was recorded. `repairJob` is `null` if the transaction has no repair-job reference. The `user` is the account that recorded the transaction; it is not necessarily the person who received or requested the part. Each row contains only the fields needed by the history table and reference IDs; it does not include price, email, `createdAt`, or duplicate relation IDs.
