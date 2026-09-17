# API Contract & DTO Design for Recommendations & Smart Swap

Type: task
Status: resolved
Blocked by: none

## Question

What are the exact Request Query DTOs and Response DTO schemas for:
1. `GET /borrowings/recommendations` (Catalog-level ranked recommendation query by `model` or `equipmentTypeId` with `isRecommended` badge and usage metrics)
2. `GET /borrowings/recommendations/swap-check` (Direct validation endpoint checking if a better alternative asset exists for a user's selected `assetId`, returning `hasBetterAlternative` and `recommendedAsset`)?

## Answer

### 1. `GET /borrowings/recommendations` (Catalog Recommendation)

- **Query Parameters (`QueryBorrowRecommendationsDto`):**
  - `model?: string` (e.g. "Puritan Bennett 840")
  - `equipmentTypeId?: number`

- **Response Payload:**
  - `model: string`
  - `totalAvailable: number`
  - `recommendedAssetId: string`
  - `candidates: CandidateAssetDto[]`
    - `assetId: string`
    - `noid: string`
    - `name: string`
    - `model: string`
    - `serialNo: string | null`
    - `sectionName: string`
    - `usageDays90d: number`
    - `idleDays: number`
    - `borrowCount90d: number`
    - `isRecommended: boolean`
    - `recommendationReason: string`

---

### 2. `GET /borrowings/recommendations/swap-check` (Smart Swap Nudge)

- **Query Parameters (`CheckSwapDto`):**
  - `assetId: string` (UUID of user-selected asset)

- **Response Payload:**
  - `selectedAsset`: `{ id, noid, name, model, usageDays90d, idleDays }`
  - `hasBetterAlternative: boolean`
  - `recommendedAsset: RecommendedAssetDto | null`
    - `id: string`
    - `noid: string`
    - `name: string`
    - `model: string`
    - `usageDays90d: number`
    - `idleDays: number`
    - `daysUsageDifference: number`
    - `nudgeReason: string`

