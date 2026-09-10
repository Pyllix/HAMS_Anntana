# API Contract & DTO Design

Type: task
Status: resolved
Blocked by: none

## Question

What are the exact Request Query DTO parameters (filtering by `viabilityStatus`, `sectionId`, `assetTypeId`, `search`, `minCostRatio`, `page`, `limit`) and Response DTO schemas for:
1. `GET /assets/viability` (Paginated list with summary counter cards: Total, Viable, Warning, Unviable)
2. `GET /assets/:id/viability` (Single asset comprehensive audit breakdown: asset basic info, purchase price, age in years/months, useful life, cumulative repair cost breakdown, historical repair jobs list, and recommendation reason string for frontend card & PDF export)?

## Answer

### 1. `GET /assets/viability` (Paginated Viability Audit List & KPI Summary)

- **Access Roles:** `PARCEL_STAFF`, `MAINTENANCE_HEAD`, `ADMIN`, `MANAGER`
- **Request Query DTO (`QueryAssetViabilityDto`):**
  - `page?: number = 1`
  - `limit?: number = 20` (max 100)
  - `viabilityStatus?: 'ALL' | 'VIABLE' | 'WARNING' | 'UNVIABLE'`
  - `sectionId?: string` (UUID)
  - `assetTypeId?: number`
  - `search?: string` (matches `name`, `model`, `serialNo`, `noid`)
  - `sortBy?: 'costRatio' | 'cumulativeCost' | 'repairCount' | 'age' | 'createdAt' = 'costRatio'`
  - `sortOrder?: 'asc' | 'desc' = 'desc'`

- **Response Payload:**
  - `summary`:
    - `totalEvaluated: number`
    - `viableCount: number`
    - `warningCount: number`
    - `unviableCount: number`
    - `totalCumulativeRepairCost: number`
  - `items: AssetViabilityItemDto[]`:
    - `id: string`
    - `noid: string | null`
    - `name: string`
    - `model: string`
    - `serialNo: string | null`
    - `price: number`
    - `receivedDate: string`
    - `warrantyDate: string | null`
    - `isWarrantyActive: boolean`
    - `assetType: { id: number, name: string, usefulLife: number }`
    - `section: { id: string, name: string }`
    - `assetStatus: { id: number, code: string, name: string }`
    - `metrics`:
      - `ageYears: number`
      - `usefulLifeYears: number`
      - `isUsefulLifeExceeded: boolean`
      - `cumulativeRepairCost: number`
      - `costRatioPercentage: number | null`
      - `totalRepairCount: number`
      - `recentRepairCount: number`
    - `viabilityStatus: 'VIABLE' | 'WARNING' | 'UNVIABLE'`
    - `viabilityReason: string`
  - `pagination`:
    - `total: number`, `page: number`, `limit: number`, `totalPages: number`, `hasNext: boolean`, `hasPrev: boolean`

---

### 2. `GET /assets/:id/viability` (Single Asset Deep-Dive & PDF Export Source)

- **Access Roles:** `PARCEL_STAFF`, `MAINTENANCE_HEAD`, `ADMIN`, `MANAGER`
- **Response Payload:**
  - `asset`: Basic asset information, category, section, status, and image URL.
  - `viability`: Status (`VIABLE` | `WARNING` | `UNVIABLE`), detailed reason string, cost ratio percentage, age in years, useful life years, repair counts, and itemized financial breakdown (`originalPrice`, `cumulativeRepairCost`, `totalOutsourceCost`, `totalSparePartsCost`).
  - `repairHistory`: Chronological array of past repair jobs with job number, symptoms, solutions, outsource costs, parts costs, and itemized spare parts list.
  - `disposalRecommendation`:
    - `recommendedAction: 'PROCEED_REPAIR' | 'CAUTION_REPAIR' | 'RECOMMEND_DISPOSAL'`
    - `actionLabel: string` (e.g. "เสนอพิจารณาแทงจำหน่าย")
    - `canInitiateDisposal: boolean`

