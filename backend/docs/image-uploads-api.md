# Image upload, read, and cleanup API (Tickets 01–04)

This document covers direct upload authorization and verification (Ticket 01), the additive Asset/User CRUD attachment contract (Ticket 02), authenticated read/preview behavior (Ticket 03), and durable image cleanup/recovery (Ticket 04). Completing an upload creates a verified pending image; it does not change an Asset or User record.

Upload, status, preview, photo-grant, and photo-read error responses use `Cache-Control: private, no-store`. The session endpoint uses `Cache-Control: private, no-store`. Requests use the existing HAMS cookie session, CSRF, session-lifetime, mandatory-enrollment/2FA, and role guards.

## Create an upload intent

`POST /images/uploads`

Asset Image is available to `ADMIN`, `ASSET_CENTER_STAFF`, and `PARCEL_STAFF`. Employee Photo is restricted to `ADMIN`, including a photo managed for the administrator's own account.

For an existing record, supply its canonical ID. For a create form, omit `targetId`; HAMS returns a random `creationContextToken` and stores only its SHA-256 hash.

```json
{
  "purpose": "ASSET_IMAGE",
  "sourceContentType": "image/jpeg",
  "sourceSizeBytes": 842013,
  "targetId": "existing-asset-id"
}
```

`sourceContentType` and `sourceSizeBytes` are early client declarations, not trusted evidence. The server accepts JPEG, PNG, static WebP, HEIC, and HEIF declarations up to 10,000,000 bytes. Provider-side source checks remain authoritative.

```json
{
  "uploadId": "e9b0e28e-71b0-4ec5-b84b-a8d4b85f1ef1",
  "purpose": "ASSET_IMAGE",
  "status": "AUTHORIZED",
  "targetId": "existing-asset-id",
  "creationContextToken": null,
  "issuedAt": "2026-10-01T00:00:00.000Z",
  "signatureExpiresAt": "2026-10-01T01:00:00.000Z",
  "intentExpiresAt": "2026-10-01T01:00:00.000Z",
  "attachmentExpiresAt": null,
  "attachmentWindowSeconds": 3600,
  "acceptedSourceMimeTypes": [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif"
  ],
  "uploadInstructions": {
    "url": "https://api.cloudinary.com/v1_1/<cloud>/image/upload",
    "method": "POST",
    "fields": {
      "api_key": "<public API key>",
      "public_id": "hams-asset-image-<uuid>",
      "overwrite": "false",
      "backup": "false",
      "type": "upload",
      "timestamp": "1790812800",
      "allowed_formats": "jpg,jpeg,png,webp,heic,heif",
      "transformation": "<server-signed incoming transformation>",
      "eval": "<server-signed source policy>",
      "signature": "<temporary signature>"
    },
    "expiresAt": "2026-10-01T01:00:00.000Z"
  }
}
```

The browser sends the file and every returned field directly to Cloudinary as `multipart/form-data`. Do not send a file, Base64, URL, filename, Cloudinary secret, or arbitrary transformation to HAMS. With browser `FormData`, let the browser set the multipart `Content-Type` boundary.

Both purposes use Cloudinary's `/image/upload` REST endpoint. The signed `type` form field is `upload` for Asset Image and `authenticated` for Employee Photo; forward every returned field unchanged.

The provider signature, HAMS intent, and pending attachment use separate clocks. The intent currently defaults to one hour and cannot exceed one hour; it limits completion and new claims. The provider's trusted `created_at` starts the configurable attachment window, which defaults to and cannot exceed one hour; intent creation and completion retries do not renew it. Until verification, `attachmentExpiresAt` is `null`. HAMS retains a `reconciliationAfter` tombstone through the later of provider authorization and intent expiry plus the configured settlement horizon; that internal value is visible on status responses and is not a claim deadline.

## Verify completion

`POST /images/uploads/:uploadId/complete`

Pass only the signed identity fields from Cloudinary's upload result. HAMS checks that provider signature and independently looks up the preallocated image through Cloudinary's authenticated API. The client does not get to choose a URL, provider, public ID, delivery type, or transformation.

```json
{
  "publicId": "hams-asset-image-<uuid>",
  "version": 1790812800,
  "signature": "<Cloudinary response signature>"
}
```

Success returns `200` with `status: "VERIFIED_PENDING"`, the fixed `attachmentExpiresAt`, and normalized JPEG output metadata. Repeating the same completion returns the same result and does not extend its deadline. A different result after verification conflicts.

## Read upload status

`GET /images/uploads/:uploadId`

Only the original uploader can inspect an upload, and they must still have the current purpose-specific role. A different user receives `404` so upload ownership is not disclosed. The response reports status, target ID, deadlines, and verified output metadata; it never returns upload credentials or the create-context token.

Current statuses are `AUTHORIZED`, `VERIFIED_PENDING`, `CLAIMED`, `SUPERSEDED`, `EXPIRED`, and `REJECTED`. A successful CRUD save records `claimedTargetId` and `claimedAt`; replacing that attachment changes its upload status to `SUPERSEDED` and queues its trusted object locator for later cleanup.

## Preview a verified pending upload

`GET /images/uploads/:uploadId/preview`

The original uploader may preview a `VERIFIED_PENDING` upload while its attachment window is live and the account still has current permission for that purpose. Another uploader receives `404`; an upload that is no longer pending conflicts, and an expired upload returns `410 UPLOAD_EXPIRED`. The response and errors use `Cache-Control: private, no-store`.

Asset previews use the same server-derived HTTPS versioned public URL as the saved Asset. Employee Photo previews use a Cloudinary `authenticated` download grant with a five-minute default lifetime. Preview does not make Employee Photo bytes public.

```json
{
  "purpose": "EMPLOYEE_PHOTO",
  "status": "VERIFIED_PENDING",
  "revision": "opaque-image-revision",
  "url": "https://api.cloudinary.com/v1_1/<cloud>/image/download?...",
  "expiresAt": "2026-10-01T03:05:00.000Z"
}
```

## Read an Employee Photo

`GET /users/:id/photo`

Any authenticated user who can access the existing Users API may request the current Employee Photo by user ID or employee code. This route follows the Users controller's normal authentication/visibility rules and adds no owner-only or ADMIN-only read restriction. It returns a provider-enforced, time-limited `authenticated` download grant and its actual expiry. `IMAGE_EMPLOYEE_PHOTO_READ_GRANT_SECONDS` configures the grant from 1 to 3,600 seconds; the default is 300 seconds.

```json
{
  "hasEmployeePhoto": true,
  "photoRevision": "opaque-image-revision",
  "url": "https://api.cloudinary.com/v1_1/<cloud>/image/download?...",
  "expiresAt": "2026-10-01T03:05:00.000Z"
}
```

When the user has no photo, the route returns `200` with `hasEmployeePhoto: false`, `photoRevision: null`, `url: null`, and `expiresAt: null`. A missing user returns `404 USER_NOT_FOUND`; provider/configuration failures return a non-cacheable `503`. No permanent or public fallback URL is returned for Employee Photos.

User details, user lists, and `/auth/session` include `hasEmployeePhoto` and `photoRevision`, but never a grant URL or provider locator. Managed Employee Photos keep durable `imageUrl` as `null`; the User create/update DTOs do not accept an Employee Photo URL. These responses do not issue grants for each User in a list.

Logout or session revocation prevents future HAMS grant requests. A grant already issued is a bearer URL and can remain usable until its provider expiry; logout cannot retract bytes already downloaded or cached by a client. The API and tests make no stronger promise.

## Attach an upload through Asset/User CRUD (Ticket 02)

The optional CRUD contract is controlled by `IMAGE_CRUD_ATTACHMENT_ENABLED`. Keep it `false` until the Ticket 05 shared-contract release gate is complete. When enabled, `POST /asset` and `PATCH /asset/:id` accept `imageUploadId` and, for create forms only, the `imageCreationContextToken` returned with the upload intent. `POST /users` and `PATCH /users/:id` accept the same fields for Employee Photos under the existing ADMIN-only user-management permission.

For a new record, create the upload intent without `targetId`, then send both returned values with the existing CRUD payload. For an existing record, create the intent with its canonical `targetId` and send only `imageUploadId` when saving. The API checks current permission, uploader, purpose, target or creation context, verified object identity, and attachment deadline again during the save.

Asset responses retain the server-derived, HTTPS, versioned public URL and store the provider/account/object locator and version. Employee Photos store their locator/version while durable `imageUrl` remains `null`; public Employee Photo URL inputs are not accepted. User response projections hide all provider locator fields and report only `hasEmployeePhoto` and `photoRevision`. Omitting the image fields or sending a null reference during an edit preserves the currently committed image. Empty or malformed upload IDs fail validation; there is no photo-removal endpoint.

The business record, locator fields, upload claim, and cleanup work for the actually superseded managed image commit in one database transaction. Provider deletion is deferred to the cleanup ticket. Retrying the same committed create recovers its original Asset/User; retrying a superseded attachment returns the current record without restoring the old photo or replaying stale business fields.

The legacy Asset `imageUrl` input remains for the deferred caller inventory/cutover gate. Employee Photo create/update no longer accepts an `imageUrl`; callers must use `imageUploadId` for a managed photo.

## Durable cleanup and recovery (Ticket 04)

Expiry, rejection, and superseded-image cleanup are stored in PostgreSQL. The backend runs a non-blocking sweep at startup and on a configurable interval while awake. A stopped process leaves pending work, retries, and leases in the database for the next process. Provider failures do not roll back a committed Asset/User save. A lease covers the full bounded provider request sequence; retry delay grows with bounded deterministic jitter.

At or after `intentExpiresAt`, completion and new claims are rejected. An expired pending image becomes cleanup-eligible only after its reconciliation horizon; attachment expiry is based on trusted provider creation time. Attached records have no pending-image TTL. Reference checks include soft-deleted Users, and cleanup never deletes a still-referenced image. Cleanup probes only the exact HAMS-allocated identity in the known image/video/raw and upload/private/authenticated namespaces. Raw probes batch the allocated key and accepted source-extension aliases. A provider not-found result completes idempotently. This bounded scan does not search the Cloudinary account and does not apply to legacy fixture URLs.

Defaults are listed in `.env.example`. `IMAGE_UPLOAD_INTENT_WINDOW_SECONDS` and `IMAGE_UPLOAD_SETTLEMENT_HORIZON_SECONDS` control intent expiry and tombstone recovery; the settlement horizon is at least one minute to cover in-flight verification. `IMAGE_CLEANUP_INTERVAL_SECONDS`, `IMAGE_CLEANUP_BATCH_SIZE`, `IMAGE_CLEANUP_PROVIDER_REQUEST_BUDGET`, `IMAGE_CLEANUP_LEASE_SECONDS`, `IMAGE_CLEANUP_MAX_BACKOFF_SECONDS`, and `IMAGE_CLEANUP_PROVIDER_TIMEOUT_MS` bound worker activity. One allocated identity uses at most 9 Admin API requests (raw extension aliases share a request); the default budget of 18 therefore attempts at most two identities per sweep. Physical deletion can be delayed while Render sleeps or the provider is unavailable; one hour is the attachment deadline, not a physical-deletion SLA.

The opt-in Cloudinary contract test exercises an unreported raw upload, replay under the still-valid allocated signature, bounded cleanup, and repeated deletion. It is scoped to random `hams-contract-*` identities in a separate test-only cloud. The real-provider result and observed request budget are recorded in [image-cleanup-g3-verification.md](image-cleanup-g3-verification.md); do not infer provider behavior from the fake-storage HTTP tests.

## Stable feature errors

| HTTP | Code                               | Meaning                                                                   |
| ---- | ---------------------------------- | ------------------------------------------------------------------------- |
| 400  | `SOURCE_SIZE_LIMIT`                | Declared source exceeds configured early limit                            |
| 400  | `SOURCE_TYPE_NOT_ALLOWED`          | Declared source type is not supported                                     |
| 400  | `UPLOAD_EVIDENCE_INVALID`          | Evidence is malformed, forged, or identifies another object               |
| 403  | `IMAGE_PURPOSE_FORBIDDEN`          | Current role cannot manage this image purpose                             |
| 404  | `UPLOAD_NOT_FOUND`                 | Upload does not exist for this uploader                                   |
| 404  | `IMAGE_TARGET_NOT_FOUND`           | Existing Asset/User target does not exist                                 |
| 409  | `UPLOAD_OBJECT_NOT_FOUND`          | Allocated object is not present at Cloudinary yet                         |
| 409  | `UPLOAD_OBJECT_POLICY_REJECTED`    | Provider object fails identity or normalized-output policy                |
| 409  | `UPLOAD_ALREADY_VERIFIED`          | Completion differs from the previously verified result                    |
| 409  | `IMAGE_UPLOAD_NOT_CLAIMABLE`       | Upload owner, purpose, target, state, or verified identity does not match |
| 410  | `UPLOAD_EXPIRED`                   | Verified upload is past its fixed attachment deadline                     |
| 429  | `UPLOAD_RATE_LIMITED`              | Configured intent budget is reached                                       |
| 503  | `IMAGE_STORAGE_NOT_CONFIGURED`     | Required Cloudinary environment is missing or invalid                     |
| 503  | `IMAGE_STORAGE_UNAVAILABLE`        | Provider verification or storage operation is unavailable                 |
| 503  | `IMAGE_ATTACHMENT_NOT_ACTIVE`      | CRUD attachment is disabled pending the release gate                      |
| 404  | `USER_NOT_FOUND`                   | No active User matches the requested ID or employee code                  |
| 409  | `UPLOAD_PREVIEW_NOT_AVAILABLE`     | Upload is not a verified pending image                                    |
| 503  | `IMAGE_READ_CONFIGURATION_INVALID` | Employee Photo grant lifetime configuration is invalid                    |
| 503  | `IMAGE_READ_UNAVAILABLE`           | The restricted read grant or read provider is unavailable                 |

The upload endpoint rejects unrecognized fields, including Base64 and arbitrary URLs. The Asset CRUD attachment flow accepts only the verified `imageUploadId` as evidence for a managed image; the legacy Asset `imageUrl` input remains subject to the later caller cutover gate. The User CRUD attachment flow accepts only the verified `imageUploadId`. Error messages do not include provider URLs, credentials, or signed fields.

## Environment and tests

The backend reads `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`; none belong in the frontend. Optional policy defaults are in `.env.example`: 10,000,000 source bytes, 25,000,000 source pixels, a one-hour signature/attachment window, and per-hour intent budgets.

Run the HTTP acceptance suite against a disposable PostgreSQL database through `TEST_DATABASE_URL`. For a fresh local database, create one whose name contains `test`, apply the committed migrations in order, then run the focused suite. Set `DATABASE_URL` to the same checked test database before applying migrations:

```powershell
docker exec hams-postgres createdb -U postgres hams_image_upload_test_20261001
$env:TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/hams_image_upload_test_20261001?schema=public'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
pnpm exec prisma migrate deploy
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config ./test/jest-auth-integration.json --runInBand test/image-uploads.auth-integration.e2e-spec.ts
```

Do not run `prisma db push` and then replay the image migrations on a fresh database: the current schema already includes the columns and indexes those migrations add, so replaying them fails on duplicate objects. The suite checks the test-database name and confirms that the `image_upload` table exists before creating fixtures. It uses real HAMS authentication, CSRF, 2FA, RBAC, and database state, while replacing only the Cloudinary port with a deterministic fake. Adapter unit tests do not contact Cloudinary.

The real Cloudinary contract suite is opt-in with `RUN_CLOUDINARY_CONTRACTS=true`. It requires a separate test-only Cloudinary account and a synthetic fixture directory configured with the `CLOUDINARY_CONTRACT_*` variables. It refuses to run when the test and regular Cloudinary cloud names match. The suite deletes only its own random `hams-contract-*` IDs. Do not point it at an account containing unrelated or production media.

The fixture directory must contain `jpeg.jpg`, `transparent.png`, `static.webp`, `portrait.heic`, and `portrait.heif` as accepted still images. It must also contain `animated.webp`, `corrupt.jpg`, `unsupported.gif`, `oversized.jpg` (over 10,000,000 bytes), and `large-pixel.png` (over 25,000,000 source pixels) as rejection cases. For output inspection, include asymmetric `rotated.jpg` (EXIF orientation 5–8), asymmetric `mirrored.jpg` (EXIF orientation 2, 4, 5, or 7), `camera-gps-metadata.jpg` (synthetic camera and GPS EXIF), `semi-transparent.png` (pixels with partial alpha), `color-profile.jpg` (embedded ICC profile), `small.jpg` (both edges below 1,600 px), plus `large-landscape.jpg` and `large-portrait.jpg` (longest edge above 1,600 px). Keep these files synthetic and free of real employee or patient data. The test decodes the returned JPEG with Sharp, checks dimensions and absence of EXIF/IPTC/XMP, and compares its oriented, scaled, white-flattened sRGB pixels with the source within JPEG tolerance.

Prepare the synthetic pack locally with `pnpm fixtures:cloudinary`. It generates the JPEG, PNG, WebP, metadata, and size-boundary fixtures, and downloads a pinned HEVC-in-HEIF still-image test vector from the [libheif test data directory](https://github.com/strukturag/libheif/tree/master/tests/data). The same valid container tests `.heic`/`image/heic` and `.heif`/`image/heif` aliases; both require Sharp metadata decoding and one page. This does not promise support for every HEIF codec or minimized-header variant. The oversized JPEG is above HAMS's 10,000,000-byte cap but below Cloudinary's 10 MiB account cap. No employee or patient photos are used. The default output folder is `test/fixtures/cloudinary-contract`, which is ignored by Git; use `pnpm fixtures:cloudinary -- --force` to regenerate existing files or `pnpm fixtures:cloudinary -- --dir <path>` to choose another folder.

Cloudinary does not sign the resource namespace in the upload path. A raw-only upload may be stored by the provider, but HAMS must reject it: completion independently verifies only the allocated image namespace and expected delivery type. Ticket 04 must reconcile alternate raw identities, including `allocatedKey` and `allocatedKey.<accepted extension>`, through bounded, intent-scoped probes; do not scan/delete unrelated cloud media or attached images. The live suite records and deletes every returned test identity, including raw aliases. This is an application-verification boundary, not a promise that Cloudinary rejects every altered upload path.

For the opt-in contract run in PowerShell, put the separate test Cloudinary credentials in the ignored backend `.env` file, point the test at that folder, and enable the real-provider suite. Preload `dotenv/config` so Jest receives the values from `.env`:

```powershell
$env:CLOUDINARY_CONTRACT_FIXTURE_DIR = (Resolve-Path .\test\fixtures\cloudinary-contract).Path
$env:RUN_CLOUDINARY_CONTRACTS = 'true'
node -r dotenv/config ./node_modules/jest/bin/jest.js --config ./test/jest-e2e.json --runInBand test/cloudinary-image-storage.contract.e2e-spec.ts
```

The real-provider source, pixel, animated-input, HEIC/HEIF, metadata, color, orientation, output, private-access, and raw-resource checks are a release gate. A passing fake/API suite alone does not prove provider behavior. On 2026-10-02 the isolated live suite passed 23/23 tests, adapter units passed 6/6, and authenticated HAMS API tests passed 11/11. Ticket 03 adds opt-in tests for public/unauthenticated/error cache headers and grant expiry. See [image-read-g2-verification.md](image-read-g2-verification.md) for the actual G2 run status; do not infer provider Cache-Control values from the HAMS API's `private, no-store` header.

Upload signatures explicitly set `backup=false` and `overwrite=false`; unique intent keys prevent replacement revisions, and no eager transformations are requested. Incoming processing strips capture EXIF/IPTC/XMP, including synthetic camera/GPS metadata. This is not a promise that every container tag disappears: JPEG encoding/color-profile data or provider-generated provenance may remain, but must not reintroduce capture metadata. Output checks include color behavior rather than requiring every non-capture tag to vanish.
