# Disposal Action Handshake

Type: grilling
Status: resolved
Blocked by: none

## Question

When `PARCEL_STAFF` decides to act on an `UNVIABLE` asset from the viability audit view:
1. What data payload should be pre-filled for the direct disposal flow (`POST /disposals`) or status transition (`WAIT_DISPOSAL`)?
2. How should the system handle assets that have active, ongoing repair jobs (`UNDER_REPAIR`) or are currently borrowed (`BORROWED`)?
3. How should assets that have already been disposed (`DISPOSED`) be excluded from the audit list or flagged?

## Answer

### 1. Pre-disposal Guard Rules

1. **Borrowed Assets (`availabilityStatus === 'BORROWED'`):**
   - Direct disposal is strictly prohibited while an asset is deployed with a borrower.
   - The UI disables the disposal action (`canInitiateDisposal: false`) and returns `blockReason: "ASSET_CURRENTLY_BORROWED"` with message: *"ครุภัณฑ์อยู่ระหว่างการยืมใช้งาน ต้องบันทึกรับคืนเข้าคลังก่อนดำเนินการแทงจำหน่าย"*.

2. **Assets with Ongoing Repairs (`UNDER_REPAIR` or Open Repair Job):**
   - If an asset has an active, unclosed repair job, Parcel Staff is prompted to close the repair job under the `UNREPAIRABLE` custody handshake flow (`PATCH /repairs/:id/complete-unrepairable`), which automatically records the unrepairable reason and transitions the asset status to `WAIT_DISPOSAL`.

3. **Exclusion of Disposed / Lost Assets:**
   - Assets already in `DISPOSAL` or `LOST` status are excluded by default from `GET /assets/viability` (`WHERE ast.code NOT IN ('DISPOSAL', 'LOST')`).
   - They can optionally be queried by passing `includeDisposed=true`.

---

### 2. Pre-filled Handshake Payload

The single-asset viability response (`GET /assets/:id/viability`) provides a `disposalRecommendation.prefillData` block:
- `assetId`: Target asset UUID
- `noid`: Asset registration number
- `name`: Asset title
- `price`: Original purchase price
- `cumulativeRepairCost`: Total cumulative maintenance costs
- `costRatioPercentage`: Calculated cost ratio
- `suggestedDisposalReason`: Pre-formatted reason text incorporating the explainable decision tree output (e.g. *"แทงจำหน่ายเนื่องจากประเมินแล้วซ่อมไม่คุ้มค่า: ค่าซ่อมสะสม (฿337,500.00) คิดเป็น 75.0% ของราคาจัดซื้อ ซึ่งเกินเกณฑ์ร้อยละ 70 ตามระเบียบพัสดุ"*)
- Directly submits to `POST /asset/:id/disposal` with `disposalDocNo` and `approvedDate`.

