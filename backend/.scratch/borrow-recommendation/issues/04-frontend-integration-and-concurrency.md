# Frontend Integration Blueprint & Concurrency Handling

Type: task
Status: resolved
Blocked by: none

## Question

What are the frontend implementation specifications for the Catalog Badges and the Smart Swap Nudge Modal (React/Vue snippets, state binding), and how should concurrent borrowing conflicts be handled if the recommended asset is grabbed by another user milliseconds before submission?

## Answer

### 1. Frontend Integration Blueprint

- **Catalog Recommendation Badge:**
  Display an indicator badge (e.g. `🌟 แนะนำ (หมุนเวียนสมดุล)`) whenever `asset.isRecommended === true`, showing the `recommendationReason` string in a tooltip.

- **Smart Swap Nudge Modal:**
  When opening the confirm borrow modal or selecting an asset:
  1. Call `GET /borrowings/recommendations/swap-check?assetId=${selectedAssetId}`.
  2. If `hasBetterAlternative === true`: render an alert banner with the `nudgeReason`.
  3. Clicking "สลับใช้เครื่องนี้" simply updates the local form state: `setSelectedAssetId(recommendedAsset.id)`.
  4. The user can proceed with either the recommended asset or their original selection without friction.

---

### 2. Concurrency & Race Condition Handling

- **Database Protection:** `AssetBorrowService.createBorrow()` executes inside a `prisma.$transaction` and enforces that `availability_status_id === AVAILABLE`.
- **409 Conflict Fallback:** If two users concurrently submit a borrow request for the same recommended asset, the first transaction commits and the second receives `HTTP 409 Conflict`.
- **Client Graceful Recovery:** Upon receiving `409 Conflict`, the frontend displays a notification *"เครื่องนี้เพิ่งถูกยืมไป ระบบกำลังเลือกเครื่องว่างลำดับถัดไปให้คุณ"* and re-triggers `swap-check` to suggest the next best available asset seamlessly.

