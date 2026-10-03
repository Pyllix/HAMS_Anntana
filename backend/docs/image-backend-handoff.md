# Image backend verification and handoff — Ticket 05

**Readiness: NOT READY for Frontend handoff (2026-10-03).** The API contract is documented and the backend implementation is in place, but G2, G3, and G4 remain open. Do not mark Ticket 05 complete or activate managed CRUD attachments until those gates have evidence or an explicitly approved scoped decision.

## Gate status

| Gate | Status | Evidence and remaining work |
| --- | --- | --- |
| G1 — source proof and normalization | **Pass recorded** | Ticket 01 records the isolated live Cloudinary run: 23/23 tests passed with 18 synthetic fixtures, scoped cleanup completed, and zero `hams-contract-` objects remained. The API/adapter and disposable-PostgreSQL results are also recorded in [Ticket 01](../.scratch/image-upload-storage/issues/01-be-direct-upload-and-normalization.md). This Ticket 05 audit did not repeat the live run because its test account is not configured here. |
| G2 — restricted reads and cache behavior | **Pending provider evidence** | The isolated-DB HTTP suite passed 17/17, including HAMS read/preview cases, but the opt-in Cloudinary checks were not run. There are no observed provider byte-response headers, account capability results, grant-expiry observations, or account-specific delivery-cost measurements. See [G2 verification](image-read-g2-verification.md). HAMS `private, no-store` response headers do not establish Cloudinary image-byte cache behavior. |
| G3 — durable lifecycle | **Partial; provider acceptance pending** | Ticket 04 code, migration, and tests are present; the backend build, Prisma validation, and 450/450 unit tests passed. On 2026-10-03, all 29 committed migrations applied to an isolated PostgreSQL test database and the focused HTTP suite passed 17/17 with exit code 0. The live cleanup contract remains unrun, so provider deletion/replay/request-count behavior is unverified. See [Ticket 04](../.scratch/image-upload-storage/issues/04-be-image-cleanup-and-recovery.md) and [G3 verification](image-cleanup-g3-verification.md). |
| G4 — shared CRUD cutover | **Pending decision** | The existing Frontend still sends Base64 through shared Asset `imageUrl` writes, including the explicitly deferred wait-disposal form. Employee-photo displays still use `imageUrl` directly. The user reconfirmed on 2026-10-03 that the wait-disposal photo flow is to remain untouched for now; possible later removal is not an approved cutover. The caller inventory and compatibility details are below. |
| G5 — BE-to-FE readiness | **Pending** | The contract reference and setup checklist exist, but the phase barrier stays closed until G1–G4 have verified evidence or a scoped decision allowed by the spec. |

The initial Ticket 05 audit had no dedicated database or test-only Cloudinary settings. A temporary `TEST_DATABASE_URL` was subsequently set only for the isolated local PostgreSQL acceptance run. The synthetic Cloudinary fixture pack is present, but the opt-in flag and separate test-cloud credentials remain absent. No real-provider request, production configuration change, or Base64-data cleanup was performed.

## Backend contract baseline

The request/response examples, stable errors, deadlines, preview scope, employee-photo read scope, outcome recovery, and HAMS response-cache policy are documented in the [Image Upload API reference](image-uploads-api.md).

| Operation | Contract |
| --- | --- |
| Create upload intent | `POST /images/uploads`; returns a purpose-bound allocated identity and signed direct-upload instructions. The browser uploads bytes directly to Cloudinary. |
| Verify and inspect | `POST /images/uploads/:uploadId/complete` and `GET /images/uploads/:uploadId`; completion is idempotent for the same evidence and does not extend the fixed deadline. |
| Preview pending photo | `GET /images/uploads/:uploadId/preview`; limited to the authorized uploader while the verified pending attachment window remains live. |
| Attach during CRUD | `imageUploadId` plus the creation-context token when creating a record. Asset and Employee Photo fields are derived by the backend from the verified upload. Omission or null on edit preserves the current attachment; there is no removal endpoint. |
| Read Employee Photo | `GET /users/:id/photo`; returns a short-lived authenticated grant on demand. The managed photo's durable `imageUrl` is null. |

Intent, provider signature, and attachment deadlines are separate. HAMS responses containing private upload/preview/grant data use `private, no-store`; actual cache headers on Cloudinary image responses remain a G2 observation, not an established API guarantee. See the API reference and [`.env.example`](../.env.example) for the exact lifetimes, limits, and defaults.

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

The repository default in `.env.example` keeps `IMAGE_CRUD_ATTACHMENT_ENABLED=false`. The deployed value was not inspected. Keep managed CRUD attachment activation behind the release gate; do not infer production configuration from the sample file.

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
| `IMAGE_CRUD_ATTACHMENT_ENABLED` | Keep disabled until G4 and the coordinated activation decision are complete | The deployed value was not inspected. |
| `TEST_DATABASE_URL` | Disposable isolated PostgreSQL only | Required for the HTTP acceptance suite and Ticket 04 database lifecycle tests; never point these tests at a shared or production database. |
| `RUN_CLOUDINARY_CONTRACTS` and `CLOUDINARY_CONTRACT_*` | Opt-in, separate test-only Cloudinary account | Required for G2/G3 real-provider checks and manifest-scoped test cleanup. The test account must differ from the configured application cloud. |

Defaults are mirrored in [`.env.example`](../.env.example). The API reference contains the commands for the isolated HTTP and opt-in provider suites. The isolated HTTP suite has now passed; the real-provider suite remains unrun because the separate test-cloud credentials are absent.

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

1. Keep the backend contract additive and the managed CRUD feature flag off while the old shared writers remain active.
2. Retain the recorded dedicated-DB lifecycle/concurrency result and obtain the remaining G2/G3 real-provider evidence: read/cache observations and the isolated cleanup/replay run with its actual request budget.
3. Resolve G4 with proven safe isolation or a separately approved cutover decision. In particular, preserve the wait-disposal photo/custody behavior until the team decides its scope.
4. Only after gates permit FE work, implement the ordinary Asset/User form and display changes against this API reference. Test the FE build and API flow before activation.
5. Coordinate backend-first deployment and managed-write activation so old Base64 callers cannot race with managed image data. If the platform cannot provide a safe transition under the approved G4 scope, keep activation off and return for a scoped decision.
6. Record actual test results and configuration ownership, then update the G1–G5 gate table before marking Ticket 05 complete or unblocking Tickets 06/07.

No production environment was mutated and no provider-object or Base64-data cleanup was run as part of this handoff audit. The only database mutations were in the newly created local disposable test databases used for G3 verification; both were removed afterward.
