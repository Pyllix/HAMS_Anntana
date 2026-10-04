# Image backend verification and handoff — Ticket 05

**Readiness: Ticket 05 / G5 complete for isolated FE development and acceptance — 2026-10-04.** Backend Tickets 01–04 are complete, and the user approved the recommended G2 no-store policy and isolated FE transition by instructing completion of this Ticket 05 summary. Tickets 06/07 may proceed against the baseline below in a separate test environment. **Production release remains blocked by G4**: shared Asset activation still conflicts with the deferred wait-disposal photo writer. This handoff does not authorize production deployment/activation or a real customer trial. See [ADR 0005](adr/0005-employee-photo-cache-and-isolated-fe-handoff.md).

## Backend audit — 2026-10-04

| Ticket | Audit result | Remaining Backend/handoff work |
| --- | --- | --- |
| 01 — upload/normalization | Complete; prior live G1 evidence retained | No missing implementation identified in this audit; full G1 was not rerun |
| 02 — CRUD attachment | Complete; current dedicated-DB HTTP acceptance passed | Keep activation gated; G4 is still open |
| 03 — read/cache | Complete; Backend/provider evidence plus approved no-store policy | Helper integration/UI acceptance belongs to 06/07 |
| 04 — cleanup/recovery | Complete; current DB and live G3 acceptance passed | No pending required implementation/verification identified within the specified bounds |
| 05 — handoff | Complete for isolated FE development/acceptance | G4 remains a production release blocker; no required Backend behavior is hidden in 06/07 |

Current verification: 52 unit suites / 450 tests passed, Backend build and TypeScript passed, 29 migrations applied to fresh isolated PostgreSQL, image HTTP acceptance 17/17, and asset-status regression 18/18. The focused real Cloudinary G3 case passed 1/1, with 24 other provider cases intentionally filtered, exact-object teardown, and 27 measured delete requests across three bounded passes. The first status regression run failed because its old attachment-service stub missed a method; using the real service repaired the test and the original full status scenario passed. The touched test's ESLint check passed. Both audit database containers were removed. No production backend behavior, frontend file, application environment, or deferred wait-disposal flow was changed.

### Approved scope decisions — 2026-10-04

- **G2 — approved:** adopt the tested direct-browser fetch with Fetch `no-store`, explicit request `Cache-Control: no-store`, `credentials: 'omit'`, and session-memory Blob display. Existing Backend grants stay expiring and provider headers stay recorded as observed. Copied-grant navigation does not inherit the HAMS request directive, and downloaded bytes cannot be recalled. Helper/UI acceptance belongs to 06/07; it is not required before closing Backend Ticket 03.
- **G4 — still open for production:** the unchanged wait-disposal form sends status, remark, and a selected Base64 photo together. For an Asset with a managed image, a changed legacy `imageUrl` produces `MANAGED_IMAGE_REQUIRES_VERIFIED_UPLOAD`; the transaction rejects the entire save, including the status change. Leaving the form untouched is a scope deferral, not proof of compatibility after activation. The feature flag keeps new managed attachments off but does not solve the conflict once enabled. Production still needs a proven isolation/activation transition decision.

The user approved separating isolated FE development/acceptance from production activation: build and verify 06/07 in a disposable environment, keep production managed-write activation disabled, and retain G4 as a release blocker. This supersedes the former Ticket 05 rule requiring G4 resolution before any FE implementation. The actual deployed flag value was not inspected or changed. No temporary Base64 exception, silent field ignore, or wait-disposal change is authorized.

### Environment boundary for the FE handoff

Use a separate local/test Backend process and disposable PostgreSQL database with only synthetic test data. Point that process's `DATABASE_URL` at the checked test database and its provider credentials at the separate test-only Cloudinary cloud; do not reuse the application database or provider cloud. Enable `IMAGE_CRUD_ATTACHMENT_ENABLED=true` only in that isolated process for integration acceptance. Keep the repository default and production activation policy at `false`; this document does not mutate settings or certify a deployed value. Track known test-upload identities and use scoped cleanup. No production deployment or real customer trial proceeds while G4 is unresolved.

## Gate status

| Gate | Status | Evidence and remaining work |
| --- | --- | --- |
| G1 — source proof and normalization | **Pass recorded** | Ticket 01 records the isolated live Cloudinary run: 23/23 tests passed with 18 synthetic fixtures, scoped cleanup completed, and zero `hams-contract-` objects remained. The API/adapter and disposable-PostgreSQL results are also recorded in [Ticket 01](../.scratch/image-upload-storage/issues/01-be-direct-upload-and-normalization.md). The later G2-focused run did not repeat all G1 cases. |
| G2 — restricted reads and cache behavior | **Complete with scoped policy — 2026-10-04** | The live case passed 1/1 with scoped teardown: public Asset access, unsigned Employee denial, five-minute/short-grant success, fresh expiry denial, and actual headers. The user accepts public versioned Asset 30-day caching and controlled HAMS Employee no-store retrieval, proven feasible in isolated Edge. Employee byte success still returns `public, max-age=2592000`; no provider response override is claimed. Helper/UI lifecycle acceptance remains 06/07. See [G2 verification](image-read-g2-verification.md), [delivery options](cloudinary-employee-photo-cache-options.md), and [ADR 0005](adr/0005-employee-photo-cache-and-isolated-fe-handoff.md). No account-specific bandwidth charge was measured. |
| G3 — durable lifecycle | **Pass recorded — 2026-10-04** | Current dedicated-DB HTTP acceptance passed 17/17, including lifecycle/concurrency/recovery. The focused live Cloudinary cleanup case passed 1/1 with scoped teardown: raw alias recovery, replay after deletion, and repeated not-found cleanup. Three passes used 27 Admin API delete requests, nine per identity per pass. Other provider cases were intentionally filtered. See [Ticket 04](../.scratch/image-upload-storage/issues/04-be-image-cleanup-and-recovery.md) and [G3 verification](image-cleanup-g3-verification.md) for bounds. |
| G4 — shared CRUD cutover | **Open; production release blocker** | The unchanged wait-disposal Base64 photo write conflicts with managed Asset images; possible later removal is not an approved cutover. The 2026-10-04 decision allows isolated FE implementation/acceptance with this conflict recorded, while production remains gated. This does not mark all shared callers migrated or compatible. |
| G5 — BE-to-FE readiness | **Complete for isolated FE — 2026-10-04** | The stable contract, setup checklist, G1–G3 evidence, approved no-store policy, and isolated transition are recorded. Ticket 05 unblocks 06/07 under this scope. G4 production cutover and full UI/release acceptance remain open. |

The initial Ticket 05 audit had no dedicated database or test-only Cloudinary settings. Temporary `TEST_DATABASE_URL` values were subsequently set only for isolated local PostgreSQL acceptance. A separate test-only Cloudinary cloud was configured for the G2 and later G3 cases; both used synthetic fixtures and test-scoped cleanup. No production configuration change or Base64-data cleanup was performed. The G3 live cleanup/replay case passed on 2026-10-04.

## Backend contract baseline

The request/response examples, stable errors, deadlines, preview scope, employee-photo read scope, outcome recovery, and HAMS response-cache policy are documented in the [Image Upload API reference](image-uploads-api.md).

| Operation | Contract |
| --- | --- |
| Create upload intent | `POST /images/uploads`; returns a purpose-bound allocated identity and signed direct-upload instructions. The browser uploads bytes directly to Cloudinary. |
| Verify and inspect | `POST /images/uploads/:uploadId/complete` and `GET /images/uploads/:uploadId`; completion is idempotent for the same evidence and does not extend the fixed deadline. |
| Preview pending photo | `GET /images/uploads/:uploadId/preview`; limited to the authorized uploader while the verified pending attachment window remains live. |
| Attach during CRUD | `imageUploadId` plus the creation-context token when creating a record. Asset and Employee Photo fields are derived by the backend from the verified upload. Omission or null on edit preserves the current attachment; there is no removal endpoint. |
| Read Employee Photo | `GET /users/:id/photo`; returns a short-lived authenticated grant on demand. The managed photo's durable `imageUrl` is null. |

**Contract baseline: 2026-10-04.** Intent, provider signature, and attachment deadlines are separate. HAMS responses containing private upload/preview/grant data use `private, no-store`; Cloudinary byte headers remain different as recorded, with the approved Employee no-store policy implemented at the client request. See the API reference, [G2 verification](image-read-g2-verification.md), and [`.env.example`](../.env.example) for exact lifetimes, limits, and defaults. This handoff changes no API field, endpoint, or Backend runtime behavior.

## Shared caller inventory and compatibility

This is a read-only inventory. No Frontend files were changed.

| Area | Current caller | Compatibility impact |
| --- | --- | --- |
| Ordinary Asset create/edit | [`AssetFormModal.tsx`](../../front-end/src/components/equipment-stock/AssetFormModal.tsx) reads a file as a Data URL, converts it to JPEG with a canvas, then sends `imageUrl` to both `createAsset` and `updateAsset`. | It has not moved to the direct-upload/`imageUploadId` contract. Do not treat all Asset image writes as migrated. |
| Deferred wait-disposal write | [`WaitDisposalModal.tsx`](../../front-end/src/components/equipment-stock/WaitDisposalModal.tsx) reads a Data URL and sends `asset_status_id`, `remark`, and optional `imageUrl` in one `updateAsset` call. | The spec explicitly leaves the photo field and custody flow undecided. If this tries to replace an already managed Asset image with Base64, the backend rejects the changed image URL; because status and photo are in the same update, that request fails as a whole. Do not remove the photo field, ignore it, or migrate it without the separate team decision. |
| Status-only Asset updates | [`ConfirmDisposalModal.tsx`](../../front-end/src/components/equipment-stock/ConfirmDisposalModal.tsx) and [`ConfirmLostModal.tsx`](../../front-end/src/components/equipment-stock/ConfirmLostModal.tsx) submit status fields without an image. | These callers do not intentionally replace the image. Keep omission semantics so metadata/status edits preserve a committed image. |
| Asset displays | Asset stock, equipment details, borrow/return, disposal/lost tables, and repair/receipt projections read the Asset `imageUrl`. | This remains compatible with server-derived versioned public Asset URLs. Fixture URLs are unmanaged display values and must not be adopted as provider objects. |
| User create/edit writes | [`DialogAddUser.tsx`](../../front-end/src/components/user-management/DialogAddUser.tsx), [`DialogEditUser.tsx`](../../front-end/src/components/user-management/DialogEditUser.tsx), [`userService.ts`](../../front-end/src/services/userService.ts), and [`TypeUser.tsx`](../../front-end/src/types/TypeUser.tsx) define the current forms, payloads, and API calls. | No current user create/edit photo writer was found: `UserDto`/`UserUpdateDto` carry no image field and the forms have no photo input. Employee Photo display still needs the managed read flow below. |
| Employee Photo displays | [`Header.tsx`](../../front-end/src/layout/Header.tsx), [`TypeUser.tsx`](../../front-end/src/types/TypeUser.tsx), [`DialogDetailUser.tsx`](../../front-end/src/components/user-management/DialogDetailUser.tsx), [`DialogDelUser.tsx`](../../front-end/src/components/user-management/DialogDelUser.tsx), [`UserInfo.tsx`](../../front-end/src/components/user-management/table-compnent/UserInfo.tsx), and [`ConfirmRepairModal.tsx`](../../front-end/src/components/help-desk/ConfirmRepairModal.tsx) use `user.imageUrl`. | Managed Employee Photos return durable `imageUrl: null`; the Frontend types do not yet include `hasEmployeePhoto`/`photoRevision`, and these consumers do not request `GET /users/:id/photo`. The FE tickets need one grant/revision-aware display helper. |

The repository default in `.env.example` keeps `IMAGE_CRUD_ATTACHMENT_ENABLED=false`. The deployed value was not inspected. Managed CRUD activation is permitted only in the separate test process for 06/07 acceptance; production activation stays behind G4 and coordinated release acceptance. Do not infer production configuration from the sample file.

On 2026-10-03, the user reconfirmed that the wait-disposal photo field must not be changed now; the team may remove it later. This leaves G4 open because a wait-disposal request that includes a changed Base64 `imageUrl` still conflicts with an Asset whose image is managed. No silent field ignore, temporary Base64 exception, or wait-disposal migration is authorized by this clarification.

## Configuration and test setup

Keep the following settings and checks in the BE-only configuration. Cloudinary API secrets must never be copied to Frontend settings or handoff examples.

| Setting or policy | Verify | Purpose |
| --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Present only in backend runtime and test environments | Backend-only application account credentials. |
| Signed purpose policies | Confirm `ASSET_IMAGE` and `EMPLOYEE_PHOTO` retain their separate access policies | BE signs purpose-specific type and transformations; the Frontend cannot select a purpose policy or arbitrary provider options. |
| `IMAGE_UPLOAD_MAX_SOURCE_BYTES`, `IMAGE_UPLOAD_MAX_SOURCE_PIXELS` | Confirm configured limits and verify enforceability against G1 evidence | Source byte/pixel limits must be enforced by the provider/source checks. |
| Accepted source formats | Compare declared-type checks with the provider/source evidence recorded for G1 | Do not rely on declared MIME type alone. |
| Normalization policy | Confirm BE-owned output policy; do not add a Frontend override | Output format and dimensions are signed by BE. |
| Intent and completion rate limits | Review `IMAGE_UPLOAD_MAX_INTENTS_PER_ACTOR_PER_HOUR`, `IMAGE_UPLOAD_MAX_INTENTS_PER_CLOUD_PER_HOUR`, and `IMAGE_UPLOAD_MAX_COMPLETION_ATTEMPTS_PER_INTENT` | Bound intent creation and verification attempts. |
| Grant, intent, and attachment lifetimes | Review `IMAGE_UPLOAD_SIGNATURE_WINDOW_SECONDS`, `IMAGE_UPLOAD_INTENT_WINDOW_SECONDS`, and `IMAGE_UPLOAD_ATTACHMENT_WINDOW_SECONDS` against the API contract | Keep provider grant, HAMS intent, and pending attachment deadlines distinct; attachment uses trusted provider creation time. |
| `IMAGE_UPLOAD_SETTLEMENT_HORIZON_SECONDS` | Confirm late-upload reconciliation retention against the API contract | Retain tombstones for in-flight/late-upload reconciliation. |
| `IMAGE_EMPLOYEE_PHOTO_READ_GRANT_SECONDS` | Confirm short-lived grant policy and API contract | Employee Photo grants are issued on demand and are not durable URLs. |
| Cleanup sweep settings | Review `IMAGE_CLEANUP_INTERVAL_SECONDS`, `IMAGE_CLEANUP_BATCH_SIZE`, `IMAGE_CLEANUP_PROVIDER_REQUEST_BUDGET`, `IMAGE_CLEANUP_LEASE_SECONDS`, `IMAGE_CLEANUP_MAX_BACKOFF_SECONDS`, and `IMAGE_CLEANUP_PROVIDER_TIMEOUT_MS` | Bound cleanup work, provider leases, retry delay, and requests. Validate request counts in G3 evidence. |
| `IMAGE_CRUD_ATTACHMENT_ENABLED` | Enable only in the isolated test Backend for 06/07; keep production disabled until G4/release acceptance | The deployed value was not inspected or changed. |
| `TEST_DATABASE_URL` | Disposable isolated PostgreSQL only | Required for the HTTP acceptance suite and Ticket 04 database lifecycle tests; never point these tests at a shared or production database. |
| `RUN_CLOUDINARY_CONTRACTS` and `CLOUDINARY_CONTRACT_*` | Opt-in, separate test-only Cloudinary account | Required for G2/G3 real-provider checks and manifest-scoped test cleanup. The test account must differ from the configured application cloud. |

Defaults are mirrored in [`.env.example`](../.env.example). The API reference contains the commands for the isolated HTTP and opt-in provider suites. The isolated HTTP suite and focused G2/G3 real-provider cases have passed. The subsequent user-approved G2 policy and isolated transition complete the Backend handoff, while G4 remains unresolved for production.

Missing or invalid provider configuration must fail image upload/read operations explicitly. The contract has no fallback to public Employee Photo URLs, local image storage, or sending image bytes/Base64 through HAMS.

## Seeds and test-residue cleanup

`prisma/seed.ts` contains Asset mock-up `https://images.unsplash.com/...` URLs and no managed provider locators. The seeded user entries do not set Employee Photo URLs. Keep those Asset fixture URLs as unmanaged display data; do not fetch, sign, or delete them through Cloudinary cleanup.

**Base64 test-residue cleanup is prepared, not executed.** No database rows were inspected during this audit. If an authorized disposable test database needs cleanup:

1. Connect only through its isolated `TEST_DATABASE_URL` and first run read-only inventory queries:

   ```sql
   SELECT asset_id, image_url
   FROM asset
   WHERE image_url ILIKE 'data:image/%;base64,%'
   ORDER BY asset_id;

   SELECT id, "imageUrl"
   FROM users
   WHERE "imageUrl" ILIKE 'data:image/%;base64,%'
   ORDER BY id;
   ```

2. Inspect and record the exact IDs and image-field values. Clear only IDs proven to belong to the specific disposable test run; never classify every Data URL as disposable without checking its target.
3. In a reviewed transaction, update only those allowlisted rows while rechecking the same `data:image/%;base64,%` predicate. Set `asset.image_url` to `''` and `users."imageUrl"` to `NULL`, capture each `RETURNING` ID, and compare the result count with the reviewed list. Roll back on any mismatch.
4. Do not delete Asset/User rows, reset a database, clear seed URLs, or remove provider objects inferred from URL strings. This procedure has not been executed against any environment.

## Release sequence and remaining work

1. Retain this verified Backend contract and keep production managed CRUD activation disabled while G4 is unresolved.
2. Implement Ticket 06, then Ticket 07, using disposable data and the separate test-only provider cloud. Enable managed attachments only in that isolated Backend process, implement the approved Employee no-store helper, and record actual UI/integration evidence.
3. Preserve the deferred wait-disposal form and record its selected-photo conflict as a known release blocker; passing ordinary CRUD tests does not resolve it.
4. Before production deployment/activation or a real customer trial, resolve G4 through proven safe isolation or a separately approved transition, then complete release acceptance and confirm configuration ownership.
5. Coordinate Backend-first deployment and managed-write activation so old Base64 callers cannot race with managed image data. Keep activation off if safe transition cannot be established.
6. Ticket 05/G5 is complete for the approved isolated FE scope. Keep G4 and actual FE acceptance status visible until their evidence/decisions are complete; do not declare the full feature released from this handoff alone.

No production environment or application provider objects were mutated. Provider cleanup was limited to the synthetic contract-test manifest; no Base64-data cleanup was performed. Disposable audit databases were removed. This Ticket 05 summary changes documentation only and relies on the recorded earlier test results.
