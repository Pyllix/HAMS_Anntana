---
title: HAMS Asset Image and Employee Photo — Cloudinary with Storage Abstraction
labels:
  - ready-for-agent
status: backend-handoff-complete-for-isolated-frontend
updated: 2026-10-04
implementation-order: backend-first-then-frontend
---

# อัปโหลดรูปครุภัณฑ์และรูปประจำบุคลากรผ่าน Cloudinary

สเปกฉบับหลักของ feature นี้ สังเคราะห์จากข้อสรุปที่ผู้ใช้ยืนยันแล้ว Backend 01–05 ผ่านการส่งมอบสำหรับพัฒนาและทดสอบ FE ในสภาพแวดล้อมแยกตามมติวันที่ 2026-10-04; G4 ยังเป็นเงื่อนไขก่อนเปิดใช้ production การติด label `ready-for-agent` ไม่ใช่การอนุญาตเปิดใช้งานจริง ต้องรักษา verification gates และขอบเขตที่ยังเว้นไว้ตามเอกสารนี้

## Problem Statement

HAMS ต้องมีรูปหลักของครุภัณฑ์และรูปประจำบุคลากรเพื่อช่วยระบุเครื่องและพนักงาน ปัจจุบันหน้าจอ CRUD ครุภัณฑ์ส่งรูปเป็น Base64 Data URL ไปเก็บในฐานข้อมูล ส่วนหน้าจอจัดการผู้ใช้ยังไม่มี flow เลือกและอัปโหลดรูปที่ครบถ้วน

โครงการเริ่มจากงานนักศึกษา แต่มีลูกค้าจริง ต้องทดลองได้ด้วย free tier ลดภาระ Render และไม่ผูก business logic กับ Cloudinary จนย้ายผู้ให้บริการในอนาคตได้ยาก ขณะเดียวกันต้องไม่ทำให้รูปพนักงานเป็น public URL ถาวร ไม่ทำรูปเดิมหายเมื่อบันทึกไม่สำเร็จ และไม่สะสมไฟล์จากการปิดฟอร์มหรือเปลี่ยนรูป

ส่วนรอจำหน่ายมีความเข้าใจในทีมที่ยังไม่ตรงกัน ผู้ใช้ขอเว้นไว้ก่อน งานนี้จึงต้องเดินหน้าส่วน asset/user ที่แยกได้ โดยไม่ตัดสิน flow รอจำหน่ายหรือเปลี่ยน shared API จนกระทบส่วนนั้นโดยไม่รู้ตัว

## Solution

เพิ่ม flow เลือกไฟล์ → ขออนุญาตจาก HAMS → อัปโหลดตรงไป Cloudinary → ตรวจผลจาก provider → บันทึกผูกกับ record ผ่าน CRUD ตามเดิม โดยไฟล์ภาพไม่ผ่าน Render ทั้งตอนอัปโหลดและตอนเปิดดู

- **Asset Image (รูปครุภัณฑ์):** หนึ่งรูปหลักต่อทะเบียน เพิ่มหรือเปลี่ยนผ่าน CRUD ผู้มี URL เปิดดูได้โดยไม่ล็อกอิน URL ไม่มีอายุหมดอายุในตัว และเปลี่ยน URL เมื่อเปลี่ยนเนื้อหารูป
- **Employee Photo (รูปประจำบุคลากร):** หนึ่งรูปต่อบัญชี เป็น optional และ ADMIN จัดการเท่านั้น ผู้ใช้ HAMS ที่ผ่าน auth/access guards ขอ URL เปิดดูรูปที่ผูกแล้วได้ ลิงก์หมดอายุหลังออก 5 นาที
- Cloudinary แปลงไฟล์เป็น JPEG, ปรับขนาด, ทำพื้นที่โปร่งใสเป็นสีขาว และเอา metadata ที่ไม่จำเป็นออกก่อนเก็บ ไม่เก็บไฟล์ต้นฉบับอีกชุด
- รูปที่อัปโหลดแต่ยังไม่ผูกมี attachment window 1 ชั่วโมง เมื่อหมดอายุให้ล้างแบบรอบเล็ก ๆ ขณะ BE ทำงาน รูปเก่าหลังเปลี่ยนสำเร็จเข้าคิวล้าง ไม่เป็นประวัติรูปย้อนหลัง
- เก็บ URL และ provider-file metadata บน asset/user พร้อมตารางติดตาม upload/cleanup แยก ไม่บังคับใช้ central image-ID foreign key
- ทำ BE และพิสูจน์ contract ให้เสร็จก่อนเริ่ม FE; Storage Abstraction แยก business rules ออกจาก Cloudinary adapter เพื่อเตรียมเปลี่ยน provider ในอนาคต

## User Stories

1. As an ADMIN, I want to create an employee account without a photo, so that missing photos do not block account setup.
2. As an ADMIN, I want to select an employee photo during account creation, so that the account can be prepared before handover.
3. As an ADMIN, I want to add a photo to an existing account later, so that account creation and photo collection can happen separately.
4. As an ADMIN, I want to replace an employee photo through the existing edit form, so that I do not need a separate management workflow.
5. As an employee, I want my employee photo to be managed by ADMIN, so that the account uses the organization's chosen identification photo.
6. As an authenticated HAMS user, I want to view my employee photo, so that I can identify the account currently in use.
7. As an authenticated HAMS user, I want to request another employee's attached photo, so that permitted screens can identify that employee without a separate photo-role policy.
8. As an employee, I want my photo to avoid permanent public delivery links, so that casual sharing does not create unrestricted long-term access.
9. As an authorized asset editor, I want to add one main image when creating an asset, so that staff can recognize the equipment.
10. As an authorized asset editor, I want to replace the main image through ordinary asset editing, so that the image stays with the registry workflow.
11. As an authorized asset editor, I want to edit other asset information without changing the image, so that stale form data cannot overwrite the current photo.
12. As an authenticated HAMS user, I want assets without an image to show a placeholder, so that missing photos do not break the page.
13. As an asset-image URL holder, I want to open that image without HAMS login, so that the accepted public-image delivery policy works.
14. As an authenticated HAMS user, I want asset-image caching to reuse an unchanged image, so that repeated visits do not unnecessarily download it again.
15. As an authenticated HAMS user, I want a replaced asset image to have a new URL, so that long-lived caches do not keep showing the previous image as current.
16. As an uploader, I want to select JPEG, PNG, static WebP, or HEIC/HEIF images, so that ordinary camera and mobile files can be used.
17. As an uploader, I want an understandable error for an oversized or unsupported source file, so that I can choose another file.
18. As an uploader, I want image orientation to remain correct, so that mobile photos do not display sideways or mirrored incorrectly.
19. As an uploader, I want existing transparent areas to become white, so that the stored JPEG displays consistently.
20. As an uploader, I want opaque photo backgrounds to remain unchanged, so that normalization does not become background removal.
21. As an uploader, I want the normalized image to preserve aspect ratio without cropping or upscaling, so that it retains the photographed content.
22. As an employee, I want unnecessary GPS and camera metadata removed, so that embedded capture information is not unnecessarily retained.
23. As an uploader, I want to preview the uploaded result before saving, so that I can check the normalized photo.
24. As an uploader, I want cancelling a pending selection to leave the attached photo intact, so that closing or changing a form does not remove saved data.
25. As an uploader, I want a failed CRUD save to preserve the previous attached photo, so that a validation or network problem cannot destroy it.
26. As an uploader, I want to retry using a verified pending upload within its attachment window, so that I do not need to upload the same file again immediately.
27. As an uploader, I want expired pending uploads to be rejected even before physical deletion, so that attachment rules remain consistent when BE was asleep.
28. As an authorized editor, I want the last successfully committed image edit to win, so that rare simultaneous edits do not require a new conflict-review workflow.
29. As an authorized editor, I want retries after a lost response not to restore an already superseded photo, so that retrying cannot undo a newer edit.
30. As an administrator, I want upload and attachment authorization checked separately, so that an old upload grant cannot bypass current permissions.
31. As an administrator, I want one upload bound to its uploader and purpose/target, so that another caller cannot claim or share it between arbitrary records.
32. As an administrator, I want provider references derived by BE from verified results, so that a pasted or forged URL is not accepted as an application upload.
33. As an operator, I want abandoned uploads cleaned up, so that cancelled forms do not accumulate permanent cloud storage.
34. As an operator, I want superseded images cleaned up only after replacement commits, so that cleanup never removes the current attached image.
35. As an operator, I want failed cleanup recorded and retried, so that a provider outage does not lose work or undo a successful edit.
36. As an operator, I want cleanup to resume after restart or Render sleep, so that it does not depend on in-memory timers surviving forever.
37. As an operator, I want cleanup and verification to use bounded requests, so that routine image handling stays appropriate for free-tier trials.
38. As an application maintainer, I want image bytes delivered outside Render, so that the BE handles authorization and records rather than image bandwidth.
39. As an application maintainer, I want Cloudinary behind a small storage interface, so that business rules do not have to be rewritten when storage changes.
40. As an FE developer, I want documented upload, attachment, preview, and read-grant contracts, so that FE can integrate after BE verification.
41. As an FE developer, I want temporary photo grants scoped to the current session and image revision in memory, so that they are not reused across account changes or persisted as durable URLs.
42. As an API tester, I want the main acceptance tests to exercise HAMS APIs, so that they verify behavior visible to clients rather than private methods.
43. As an API tester, I want a separate real-Cloudinary contract suite, so that HEIC conversion, actual expiry, metadata, and response headers are proved against the selected service.
44. As an application maintainer, I want seed mock-up URLs treated separately from managed uploads, so that cleanup does not fetch or delete arbitrary fixture URLs.
45. As an application maintainer, I want disposable Base64 test residue cleared only from identified image fields, so that business records and unrelated data are preserved.
46. As an involved team member, I want wait-disposal behavior left unchanged until the team decides its flow, so that this feature does not silently settle a separate business disagreement.

## Implementation Decisions

### 1. Scope, authorization, and terminology

Use the domain terms **Asset Image** and **Employee Photo**, not a freely editable personal avatar. Asset metadata APIs remain protected even though asset-image bytes are public.

| Operation | Policy |
| --- | --- |
| Authorize/verify/attach Asset Image | Existing asset-create/update policy: ADMIN, ASSET_CENTER_STAFF, PARCEL_STAFF; retain any existing target-level checks |
| Authorize/verify/attach Employee Photo | ADMIN, including management of an ADMIN's own photo; no self-service exception |
| Request an attached Employee Photo grant | Any authenticated HAMS user passing existing access guards; not limited to owner/ADMIN |
| Inspect pending upload / request pending preview | Authorized uploader only, with current purpose-specific mutation permission |
| Fetch public Asset Image bytes | Any URL holder, without HAMS login |
| Fetch Employee Photo bytes | Any holder of a still-valid temporary provider URL; this bearer-link risk is accepted |

All new HAMS endpoints participate in current cookie authentication, CSRF where applicable, session-lifetime, 2FA enrollment, and RBAC gates. CORS and hidden buttons do not replace authorization. Recheck permission when verifying and attaching; an issued provider upload signature cannot itself be instantly revoked by HAMS logout. Do not broaden ADMIN operational permissions or redesign auth.

Image-only asset edits do not introduce a new borrowed/reserved/repair-status restriction. If the same request changes operational fields, existing status/availability/transaction invariants still apply. Employee-photo changes alone do not introduce password reset, session revocation, or ADMIN step-up rules beyond existing profile-edit policy.

### 2. Modules and Storage Abstraction

| Module / boundary | Responsibility and small interface |
| --- | --- |
| Image application module | Authorize upload intents, own pending lifecycle, verify completion, issue previews, coordinate attachment/cleanup |
| Storage port | Create direct-upload instructions for a policy; verify a known allocated object; produce public delivery reference or expiring read grant; delete a known object idempotently |
| Cloudinary adapter | Signing, preset/incoming transformation mapping, trusted provider lookup/result verification, authenticated download generation, provider deletion and error translation |
| Existing asset/user CRUD | Accept an upload reference, commit record-level image metadata with business changes, record actual superseded-object cleanup in the same DB transaction |
| User response/auth integration | Describe photo presence/revision without persisting or accidentally caching temporary grants; make the photo available to existing display consumers through the read contract |
| Cleanup coordinator | Process durable eligible work in bounded batches, lease work safely, retry failure, and reconcile late/unreported uploads |
| FE integration, after BE | Shared direct-upload executor and photo-display helper; CRUD forms select/preview/save, existing screens consume the new read contract |

Business modules do not call Cloudinary SDKs or construct provider URLs. The port owns provider semantics, not a broad universal file-storage framework. Only Cloudinary production adapter and a deterministic test fake are required now.

Direct-upload instructions necessarily contain provider-specific public parameters. FE executes those instructions; the abstraction does not promise that changing to S3/R2 requires zero FE work. A future adapter must satisfy normalization, restricted-read, verification, and lifecycle contracts, not merely upload bytes.

### 3. Direct-upload and normalization contract

1. FE checks the selected file for immediate feedback, then requests an upload intent with purpose, declared filename/type/size, and existing target ID or new-record context.
2. BE validates permission and target/context, allocates an unpredictable unique object key, and persists the intent **before** returning signed instructions. Provider signing is server-side only. Sign server-selected policy/key parameters, require overwrite prevention, and limit intent creation/retries per actor and environment with configurable budgets; do not offer arbitrary parameter signing.
3. FE uploads the original selected file directly to the allocated provider endpoint with server-issued parameters. HAMS does not accept the image body, convert it, proxy it, or fetch an arbitrary client URL.
4. Cloudinary applies signed/server-controlled incoming processing before storage. Replacements allocate a new object; do not overwrite bytes behind a cached URL.
5. FE submits completion evidence. BE verifies the allocated object through trusted provider information; client fields alone cannot prove format, size, dimensions, type, or ownership.
6. Only a verified, unexpired pending upload can be supplied to CRUD. Upload completion alone does not change the attachment.

| Policy | Asset Image | Employee Photo |
| --- | --- | --- |
| Source file ceiling | 10,000,000 bytes, configurable within provider limits | Same |
| Intended accepted inputs | JPEG, PNG, static WebP, HEIC/HEIF still image | Same |
| Stored format | One JPEG | One JPEG |
| Longest-edge maximum | 1,600 px | 512 px |
| Resize | Preserve ratio; no crop, no upscale | Same |
| JPEG encoder quality | Numeric 80, configurable; not `q_auto` | Same |
| Existing transparency | Flatten onto white | Same |
| Orientation | Apply source orientation before stripping its metadata | Same |
| Embedded metadata | Explicit incoming stripping of unnecessary EXIF/IPTC/XMP, including GPS/camera/capture details | Same |
| Provider delivery type | Public image delivery | `authenticated`, covering originals and derivatives |

Do not add eager variants, a retained full-resolution source, auto-format delivery, AI background removal, or image-content moderation. Verify provider backup/revision settings do not introduce an unintended retained-history policy for these objects. The white background policy only flattens alpha; it does not replace an opaque photographic background.

HEIC/HEIF upload and transformation are documented provider capabilities, but the actual account/pipeline must pass the real-provider fixtures. Incoming processing stores the normalized image rather than an unchanged original plus a derivative. [Cloudinary image formats](https://cloudinary.com/documentation/image_format_support), [incoming transformations](https://cloudinary.com/documentation/eager_and_incoming_transformations).

Use explicit incoming `fl_force_strip`; conversion alone is not metadata stripping. Cloudinary documents preservation of `DigitalSourceType` even with that flag, so do not promise every metadata tag is removed. Verify orientation, color handling, alpha edges, and downloaded output. [Cloudinary metadata stripping](https://cloudinary.com/documentation/transformation_reference#fl_force_strip).

**Source-validation gate:** the intended allowlist, static-only policy, and 10 MB limit concern the **source**, not the normalized JPEG. Returned output dimensions/bytes/format do not prove source properties. File extension, MIME, FE checks, or a valid signature over only some response fields are insufficient enforcement. Prove which server-controlled provider settings/trusted evidence enforce each requirement, including cross-resource-type attempts, animation/multiple frames, and lying about size. The provider documents no per-preset file-size cap, and top-level `format` combined with `allowed_formats` can convert otherwise rejected input; do not assume that combination enforces this policy. Prefer a separately verified incoming conversion chain. [Cloudinary upload presets](https://cloudinary.com/documentation/upload_presets), [Upload API parameters](https://cloudinary.com/documentation/image_upload_api_reference).

Source-pixel ceiling and color-space handling are account-backed technical verification items. The published Free plan lists 10 MB and 25 MP, but this spec does not establish how the pixel limit interacts with incoming resize or guarantee acceptance of every 48 MP camera file. Record the actual supported source limits and errors before handoff. If authoritative source enforcement cannot be achieved under the chosen direct-upload design, surface the exact gap for review; do not silently weaken it or move processing through Render. [Cloudinary plan limits](https://cloudinary.com/pricing/compare-plans).

### 4. Durable representation and schema invariants

Add provider-file metadata to the existing asset/user records through Prisma migrations. Logical field names below define meaning; database naming/mapping may follow repository conventions.

| Record | Durable image data |
| --- | --- |
| Asset | Existing `imageUrl` containing BE-derived HTTPS versioned public URL; nullable `storageProvider`, `storageKey`, `storageVersion`, and adapter-required immutable object/account/delivery identity |
| User | Provider-file locator/version fields; managed Employee Photo keeps durable `imageUrl` null, never a temporary signed download URL |
| Upload tracking | `uploadId`, actor, purpose, existing target or creation context, allocated key/provider context, policy revision, lifecycle state, authoritative timestamps/deadlines, verified metadata, claim/attachment outcome |
| Cleanup tracking | Exact known provider object identity, reason, eligibility time, attempts/next retry, lease/status, sanitized failure information, deletion/reconciliation outcome |

Persist only metadata needed for safe identity, verification, delivery, attachment, and deletion. Output width/height/byte size may be recorded with verification evidence; do not retain sensitive source metadata merely to prove it was removed. An upload tracking ID is an operation reference, **not** a mandatory durable image FK on asset/user.

The managed locator fields are all-present or all-absent as appropriate; no half-managed URL/locator state. Cloudinary locators must distinguish immutable object identity, public ID, version, resource/delivery type, and provider environment where needed. Never infer deletion identity from parsing a frontend or seed URL.

Index eligibility/retry and known-object lookup fields; enforce single-claim ownership in the DB. Soft-deleted users still retain their image references under existing restore behavior; they are not abandoned uploads. This feature does not add a new account-deletion retention policy.

### 5. HAMS API contract

The inspected application exposes `/asset` and `/users` without a global version prefix. The routes below are additive feature contracts; they do not authorize renaming existing API routes. Document request/response DTOs and errors in the existing API reference.

| Endpoint | Request / response and behavior |
| --- | --- |
| `POST /images/uploads` | Purpose `ASSET_IMAGE` or `EMPLOYEE_PHOTO`, declared source metadata, target ID for edit or creation context for create. Return `uploadId`, attachment deadline, policy limits, direct-upload URL/method/fields and provider authorization deadline; no secret |
| `POST /images/uploads/:uploadId/complete` | Accept bounded provider evidence; verify against the preallocated object and current authorization. Return lifecycle status, deadline and verified output summary. Idempotent for the same immutable result; does not attach |
| `GET /images/uploads/:uploadId` | Uploader-authorized status/outcome lookup, including whether an earlier save actually claimed it; supports lost-response recovery without inventing a duplicate create |
| `GET /images/uploads/:uploadId/preview` | Verified live pending upload only, authorized uploader only. Return public Asset Image preview or temporary restricted Employee Photo grant with actual `expiresAt` |
| `POST /asset`, `PATCH /asset/:id` | Optional nonempty `imageUploadId`; BE derives durable fields and commits attachment with the ordinary asset save |
| `POST /users`, `PATCH /users/:id` | Same optional `imageUploadId`, Employee Photo purpose and ADMIN policy; creation may claim before a target account ID existed |
| `GET /users/:id/photo` | Existing user lookup semantics including employee-code resolution and normal visibility rules; return a grant for the current attached photo, or an explicit no-photo response |

Missing `imageUploadId` preserves the committed image on edit and permits no image on create. `null`, empty, or malformed upload references do not clear attachments. No standalone image DELETE/remove endpoint is introduced. New cloud-backed requests do not accept arbitrary `imageUrl` or provider metadata as writable attachment fields.

For existing targets, bind the intent to the canonical target ID. For creation, bind a server-recognized creation context and uploader/purpose; claim once against the newly created record. Do not use an email/filename supplied by FE as proof of identity or permit reuse across records. Apply a unique operation outcome so retrying the same create with the same claimed upload can recover the prior target rather than create another one; no-photo creation does not require a broader CRUD idempotency redesign.

Use normal auth errors plus explicit machine-readable feature outcomes for invalid input, missing target, unverified/expired upload, wrong owner/purpose/target, already claimed/superseded upload, and provider verification unavailable. Recommended mappings: validation 400, unauthenticated 401, unauthorized 403, not found 404, invalid claim/state 409, expired unclaimed upload 410, retryable provider outage 503. Unauthorized callers must not receive provider credentials/object details or ownership-sensitive diagnostics.

Do not silently attach nothing when the requested image failed verification or expired. Preserve form data for retry; show the failed intended change rather than report it as saved successfully.

### 6. Attachment transactions, concurrency, and safe retry

Atomically commit business fields, verified record-level image metadata, upload claim/outcome, and durable cleanup eligibility for the actual superseded attachment. Do not perform provider upload/deletion/network verification inside the DB transaction. Trusted verification happens before the transaction, then recheck identity/state/deadline/permission and claim eligibility at commit.

Serialize concurrent attachment changes using DB-supported transaction/locking or equivalent conditional writes with bounded internal retry. The policy is **last successful serialized database save wins**; arrival, upload completion, or response order is not the winner. Do not add stale-photo conflict dialogs or a form-edit lock. Retain existing conflicts for unrelated operational status changes.

Example: two authorized editors initially see A; one commits B, then another commits C. C is current. Cleanup must identify A and B from their respective actual committed transitions, not twice delete the stale form's A. An edit omitting `imageUploadId` preserves the image currently committed, not the image from the editor's old snapshot.

Repeated completion/attachment of the same upload is idempotent only for its original permitted claim. A lost response after attachment is recoverable through stored outcome. A later retry of an upload that has already been superseded must not reattach it, overwrite newer metadata, or make it claimable again; return its committed outcome/superseded status explicitly. This feature does not require accepting the same upload for a different target.

For user creation, preserve existing prevalidation and BetterAuth compensating rollback. Final profile creation/photo claim must commit together; failure after BetterAuth signup must not leave a claimed photo pointing to an account that is rolled back. Provider cleanup is separate and retryable. Photo-response/grant failure **after** a successful DB commit must not trigger account compensation or pretend the save rolled back.

### 7. Pending lifecycle and cleanup

Track at least authorized, verified-pending, attached, expired/rejected, and cleanup-pending/deleted outcomes. State names may vary, but invalid transitions, repeated requests, and crash recovery must preserve these rules.

- The configurable unattached window is **1 hour**, replacing the earlier 24-hour proposal. Technical clock rule: use trusted provider creation time for a successfully uploaded normalized object, never FE time or completion retry time. Complete within the issued upload-intent deadline; neither re-verification nor repeated completion renews deadlines.
- Persist the provider authorization deadline and an initial intent deadline when issuing instructions. An unused intent without a reported completion still has a known allocated key and enters reconciliation; no unreported upload becomes permanent simply because FE closed before calling complete.
- At or after the attachment deadline reject any new claim, even if physical deletion has not occurred. Already committed attachments are not expired by this window; outcome-only retries remain distinguishable from new claims.
- A rejected invalid upload and an expired unattached image become cleanup candidates. A pending selection abandoned or replaced in a form does not alter a committed photo; TTL cleanup is sufficient, without a new public removal action.
- Superseded managed images become eligible only after replacement commits. Fixture URLs without trusted locators are not provider deletion targets.
- Keep cleanup work durable in the existing DB. Run on startup and at a configurable interval while BE is awake, with bounded batch size, request timeouts, backoff, and safe leases. Batch size and interval are technical tuning, not a promise of exact deletion at one hour.
- Before deletion, verify there is no retained live record reference and coordinate with claim state. Once a cleanup job claims an expired/superseded object for deletion, no concurrent save may attach it. Provider not-found is successful idempotent deletion, not an endless failure.
- Account for signature replay and uploads arriving while cleanup runs: an HAMS intent expiry is not provider revocation. Retain tombstones/reconciliation work through provider signature validity and a tested in-flight settlement horizon; recheck late/unreported uploads and never reopen an expired claim. Verify no late upload or cross-resource variant escapes tracking.
- Process only allocated HAMS object identities in the configured environment. Do not scan/delete the entire Cloudinary account or fetch user-supplied URLs. Reconciliation probes are bounded and budgeted; retain durable outstanding work when rate-limited.
- Cleanup failure does not undo a successful CRUD save. A restart after commit but before deleting the provider object must resume safely. Logs expose operation/state/retry information, not API secrets, full signed links, or embedded employee metadata.

Cloudinary upload signatures have provider validity of one hour from their timestamp; that is a different clock from the HAMS attachment window. A signature is not a single-use upload ticket. [Cloudinary authentication signatures](https://cloudinary.com/documentation/authentication_signatures).

Render Free can suspend an idle service, so in-process cleanup cannot execute while asleep. Delayed physical deletion after sleep, deployment, or outage is accepted; no paid worker/cron, Redis queue, persistent disk, or keep-alive workaround is required. The one-hour rule limits attachment, not the maximum possible stored lifetime during downtime. [Render Free behavior](https://render.com/docs/free).

### 8. Read URLs, cache, and response compatibility

**Assets:** persist a BE-derived HTTPS versioned CDN URL with a new unique identity for every replacement. Public URLs have no built-in expiry, but are not guaranteed permanent availability. Origin deletion/CDN invalidation cannot recall browser or third-party copies.

**Employees:** persist only locator metadata for managed photos. Issue an explicit provider-enforced expiring grant, default 5 minutes from issuance, configurable, with `expiresAt` and an opaque image revision. Protect originals and derivatives. Do not expose a permanent signed URL as a preview, session field, CRUD response, or fallback.

Cloudinary's ordinary signed CDN URL does not satisfy expiry. Use its time-limited download method with explicit expiry and `authenticated` type. That method bypasses CDN and costs twice delivery bandwidth; the provider discourages embedding it on websites. This accepted trade-off reduces Render image traffic, not Cloudinary bandwidth to zero. Confirm actual account support and measure usage. [Cloudinary media access control](https://cloudinary.com/documentation/control_access_to_media).

Logout/access changes stop future HAMS grant issuance, not a grant already issued. Anyone with the still-valid URL can retrieve it until expiry. Already downloaded/displayed bytes cannot be recalled. Request issuance and cached image display are not proof that the caller still has a session.

| Response / state | Cache contract |
| --- | --- |
| Upload authorization, status with private data, preview/read-grant responses, related auth errors | HAMS `Cache-Control: private, no-store` |
| Any API response that embeds a temporary photo grant | Same no-store rule; never place it in a shared/server session cache |
| Asset image bytes | Scoped decision 2026-10-03 accepts observed `public, no-transform, immutable, max-age=2592000` for versioned public URLs; do not claim the original desired one-year header |
| Employee image bytes | Provider success remains observed `public, max-age=2592000`; scoped decision 2026-10-04 requires controlled HAMS direct fetch with Fetch `no-store`, explicit request `Cache-Control: no-store`, and session-memory Blob display, not a provider header override |
| FE photo-grant reuse | Memory only, scoped to current session/account and image revision; expire reuse at `expiresAt`, clear on logout/account switch/replacement |

HAMS grant-response headers do not control the subsequent Cloudinary image response. Exact provider Cache-Control overrides are not assumed supported. If headers differ from the desired policy, document the observed behavior and obtain a scoped decision before claiming that policy met; do not add a Render byte proxy as a hidden fix. HTTP cache freshness and grant validity are separate. [HTTP Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control).

**Approved G2 policy — 2026-10-04:** retain the current expiring authenticated grant and fetch Employee Photo bytes directly from the provider using `cache: 'no-store'`, request header `Cache-Control: no-store`, and `credentials: 'omit'`. Display the resulting Blob from memory, validate the provider URL/status/content type, use bounded cancellation, and clear/revoke display URLs on replacement/logout/account switch/unmount while rejecting stale async results. CORS failure must surface as a load error, with no fallback to direct signed-URL display. This policy covers controlled HAMS requests; copied-grant navigation does not inherit it and existing downloaded copies cannot be erased. G2/Ticket 03 is complete on recorded Backend/provider evidence plus this decision; actual shared-helper and UI acceptance belong to 06/07. See [G2 evidence](../../docs/image-read-g2-verification.md) and [ADR 0005](../../docs/adr/0005-employee-photo-cache-and-isolated-fe-handoff.md).

**Read DTO choice:** keep asset `imageUrl` compatible for normal image display. User/list/session responses describe managed-photo presence and revision, with durable `imageUrl` null for managed Employee Photo; obtain its display URL on demand through the photo endpoint rather than generating a provider grant for every listed/nested user. Define shared `hasEmployeePhoto` and `photoRevision` response fields and the no-photo response consistently. The session's own user projection must include those fields without storing a signed URL in BetterAuth data or session caches.

FE must adapt all relevant employee-photo display consumers, including the header/session user and nested staff selectors, through one photo-display helper. No-photo is a normal placeholder; a provider/grant failure must not be misrepresented as a successful image removal. Resolve ID versus employee-code lookups to the same canonical image revision.

Do not refresh or re-download every displayed photo on a five-minute polling timer. Reuse an unexpired grant within the session/revision; request another when a new image load needs it after expiry. Prevent unbounded retry loops. Do not persist grants/previews in localStorage, service-worker caches, persisted query caches, or DB fields; clearing FE memory does not claim to erase browser/downloaded bytes.

### 9. Seed data, legacy writes, and rollout

This is a fresh system with no historical customer Base64 photos to migrate. Existing mock-up URL images are fixture data, distinguishable from provider-managed files. Asset fixture URLs may display without being adopted as managed objects. Employee fixtures must not become a production privacy bypass: seed restricted managed photos through trusted tooling or use placeholders outside explicitly isolated demos; do not sign/fetch unknown external URLs.

If image Base64 Data URLs exist, inspect exact rows/image fields, then clear only confirmed disposable test image values using the existing no-image representation. Do not delete asset/user records, reset DB, clear arbitrary Base64 data, remove seed URL images wholesale, or delete unrelated provider assets. This spec does not execute cleanup.

The existing wait-disposal form still writes Base64 through shared asset PATCH. The user's expectation that the team may remove that photo field is **not** a confirmed flow change. No temporary Base64 exception, global immediate rejection, silent field ignoring, or disposal-form migration has been approved.

Proceed with independent additive BE work: storage module, schema, upload/read endpoints, lifecycle tests, and new verified-upload contract. Before shipping shared CRUD changes, inventory callers and prove isolation from the deferred flow, or obtain a separate explicit integration/cutover decision. An additive field alone does not solve a legacy caller overwriting a managed URL while leaving locators stale. Do not label the entire shared write path migrated or safe until this gate is resolved.

Implement and deploy in this order:

1. Complete independent BE behavior and deterministic API/database tests.
2. Run isolated real-Cloudinary verification and record limits, transformation policy, replay handling, expiry, headers, and source-proof results.
3. Record the approved 2026-10-04 separation of isolated FE development from production activation: G4 remains unresolved for release, production managed writes remain disabled, and the wait-disposal business flow remains deferred.
4. Complete Ticket 05/G5 handoff for the isolated FE scope using a stable API contract, permissions, errors, no-photo semantics, setup checklist, and account-backed test evidence. Do not claim production readiness or rely solely on mocked provider tests.
5. Start Tickets 06/07 in an isolated environment with disposable test data and a separate test-only provider cloud; enable managed attachments only in that Backend process. Implement ADMIN photo fields, ordinary asset direct upload, and the shared no-store photo helper. Keep wait-disposal form/checkbox/custody logic outside this implementation.
6. Perform isolated FE-to-BE acceptance and record the known wait-disposal conflict, no-image/failure/retry/account-switch behavior, and provider usage. Before production deployment/activation or a real customer trial, resolve G4 with proven isolation or a separately approved transition and coordinate old/new callers. No production activation is authorized by this handoff.

Configuration includes provider environment/credentials, signed purpose-specific upload policies, quality/dimension/source limits, pending/grant lifetimes, cleanup schedule/budget and feature activation. Secrets remain BE-only. Missing/invalid storage configuration must fail feature activation clearly, not fall back to public employee images, unmanaged URLs, Base64, or local disk.

## Testing Decisions

The user confirmed on 2026-10-01: **test primarily through HAMS APIs; keep real Cloudinary behavior in a separate suite**. Test externally observable contracts, authorization, DB outcomes, and file delivery—not private method order, SDK call shapes, exact scheduler internals, or chosen table names.

### Main seam: HAMS HTTP APIs with a deterministic provider

Reuse the project's existing Nest/Supertest API patterns, real cookie-auth contract tests, user-creation compensation cases, and PostgreSQL asset-status invariant tests. New tests should exercise real production DTOs/guards for security cases. A test fake at the storage port controls provider outcomes and a clock seam controls time; it must not replace authentication or simulate transaction guarantees with simplistic in-memory mocks.

Use a dedicated disposable PostgreSQL test database, protected by the existing `TEST_DATABASE_URL` safety checks, for attachment/claim/outbox atomicity and concurrency. Smaller existing-style service tests may support pure policy/error cases, but the acceptance claim rests on HTTP-visible behavior and actual database guarantees. Tests without the required DB must report that suite not run rather than pass vacuously.

Acceptance coverage:

1. Unauthenticated, expired-session, blocked enrollment, invalid CSRF, and wrong-role requests fail without an upload intent/grant/attachment side effect; every allowed mutation role succeeds only for the correct purpose.
2. Non-ADMIN cannot manage Employee Photo, even their own; any fully authorized authenticated role can obtain another employee's attached-photo grant.
3. Pending status/preview is uploader-restricted; another authenticated user cannot claim it. Wrong purpose, existing target, creation context, provider environment, or resource/delivery type is rejected.
4. Oversized declarations are rejected early; forged source/output evidence, bad proof, unexpected transformations, nonimage/animated inputs, arbitrary URL/provider locator, and output-policy violations do not become attached photos.
5. Account/asset creation without a photo succeeds; upload selection before target ID exists can be claimed exactly once when creation succeeds.
6. CRUD omission preserves the currently committed attachment; empty/null references cannot remove it. No standalone removal API exists.
7. Upload/verification alone, cancelled form, failed validation, failed DB transaction, and failed user-create compensation path do not replace/delete the prior image or retain a false claim.
8. Repeated completion returns the same live pending outcome without extending deadlines. A save retry within the window can reuse it; an expired unclaimed upload is rejected before provider deletion.
9. A response lost after commit can recover the original outcome, including creation target ID. Replaying a previously superseded claim never restores the old image or repeats stale business edits.
10. Real-DB concurrent A→B→C commits result in C current; A and B are cleanup candidates. A metadata-only stale edit preserves C. Cleanup/claim races never delete a retained attachment.
11. Replacement commits and cleanup eligibility are atomic; provider deletion is after commit. Crash/restart between these phases preserves retryable work. Provider failure does not roll back a saved record; not-found deletion succeeds idempotently.
12. Sweeps ignore live and retained soft-deleted-user references and unmanaged fixture URLs, respect batch/lease limits, resume after sleep/restart, and converge on expired, rejected, superseded, or unreported allocated uploads.
13. Late provider arrival, repeated provider signature use, and alternate-resource attempts are reconciled without reopening expired claims or leaving escaped HAMS objects.
14. Grant/credential responses and any embedded-grant responses use private/no-store; managed Employee Photo durable data and cached session responses contain no temporary/permanent delivery credential.
15. Read responses identify the current revision; old grants do not appear as the current photo after replacement. Missing photo is distinct from provider outage. Existing asset/status/auth/user-creation behavior still passes regression tests.
16. New feature routes exchange only small metadata, not image bytes. Logs/errors do not disclose provider secrets, complete signed links, or source capture metadata.

### Real Cloudinary contract suite: isolated and opt-in

Use an isolated test environment or explicitly designated test-only prefix with known allocated IDs. Never require production customer images or list/delete the whole account. Keep a manifest for teardown/retry; redact credentials and grants. Provider tests may consume free-tier credits, so run deliberately rather than for every unit-test execution.

- Upload real fixtures for JPEG, transparent PNG, static WebP, HEIC/HEIF, small and large portrait/landscape images, rotation/mirroring, GPS/camera metadata, color profiles, corrupt files, forbidden formats, animation/multiple frames, and byte/pixel boundaries.
- Inspect downloaded stored JPEG output: longest-edge cap, ratio, no crop/upscale, white alpha flattening including semi-transparent edges, correct orientation/color behavior, quality policy, stripped metadata and documented provenance exception. Verify no unchanged source or unnecessary derivative remains.
- Prove authoritative source validation with dishonest declared metadata and format/resource-type attempts. Distinguish source limits from output limits; record exactly what is and is not verified under incoming processing.
- Prove public asset URL works without HAMS auth and changes on replacement. Inspect actual provider Cache-Control success/error headers; report differences from the desired immutable one-year policy.
- Prove Employee Photo originals/derivatives cannot be fetched anonymously through unsigned/permanent public paths. Actual issued download grant works before expiry; a **fresh cache-bypassed** request fails after its explicit expiry. Use shortened configured TTL for routine timing tests plus one default five-minute contract check.
- Verify pending restricted previews, `authenticated` type, account capability, no permanent signed-link fallback, and logout blocking future grant issuance while the accepted prior bearer grant remains valid until expiry.
- Exercise delete/not-found, retry after provider failure, replay/late upload reconciliation, source-size/pixel errors, and safe manifest-scoped cleanup. Measure actual request/credit behavior, including private download bandwidth.

### FE acceptance after the BE handoff

Test ADMIN create/edit and ordinary asset CRUD end to end: select/preview, no initial photo, save success/failure, expired pending retry, cancellation, rapid file reselection, duplicate submit/lost response, and replacement with stale concurrent forms. Confirm no Base64 is persisted by the migrated normal asset form and no photo self-service/removal UI is added.

Exercise own/nested employee displays, expiry-on-next-load without polling downloads, placeholder/error states, logout/account switch and image revision invalidation. Confirm grants do not survive in persistent browser application storage and no global image changes accidentally break the deferred wait-disposal path.

### Completion and verification gates

| Gate | Required evidence before claiming the associated work complete |
| --- | --- |
| G1 — Source proof and provider normalization | Actual enforceable source format/size/static-image rules, source pixel/account limits, signed policy/result verification, tested output/metadata/color/orientation |
| G2 — Restricted reads and cache | Real provider authenticated protection and expiry, success/error headers, documented desired-versus-observed cache policy; explicit decision if the desired byte headers cannot be achieved |
| G3 — Durable lifecycle | Real-DB atomicity/concurrency tests, cleanup recovery, unreported/late/replayed uploads reconciled safely with bounded provider usage |
| G4 — Shared CRUD cutover | Production release blocker: caller inventory and proven safe isolation or separately approved activation transition; the 2026-10-04 scoped decision permits isolated FE work while G4 stays open, not production compatibility |
| G5 — BE-to-FE readiness | Stable documented contract, deterministic/account-backed evidence, known limitations, configuration checklist, and approved isolated-test transition; Ticket 05 may complete and unblock 06/07 without marking G4 production cutover passed |

Independent BE work may proceed while external/account verification or G4 is pending. `ready-for-agent` is not a claim that these gates passed. Unavailable credentials/test infrastructure mean the relevant checks remain explicitly unverified; they do not justify inventing a successful result.

**Approved phase-boundary amendment — 2026-10-04:** the user instructed proceeding with the recommended Ticket 05 summary, approving the G2 no-store policy and isolated FE handoff above. This replaces the earlier requirement to resolve G4 before any FE work. G1–G3 and G5 are complete for Backend handoff; G4 remains a production release gate with its incompatibility recorded. See [handoff](../../docs/image-backend-handoff.md).

## Out of Scope

- Wait-disposal photo fields, “ยืนยันรับเครื่องคืน”, repair outcome/custody flow, disposal evidence and associated business decisions; do not treat the user's prediction as team approval.
- Historical customer-image migration, a bulk Base64 conversion pipeline, DB reset, or deleting business records.
- Galleries, multiple photos per record, standalone photo removal, photo history, mandatory photo/account handover gates, or employee self-service avatars.
- AI/manual content review, patient/person/document detection, content-confirmation checkbox, face crop, background removal, or legal compliance certification.
- Render image proxy/processing/local image storage, paid background worker/cron, Redis queue, always-on keep-alive infrastructure, or broad hosting changes.
- Implementing S3/R2 adapters, copying future production images between providers, or promising an automatic zero-change migration.
- Redesigning authentication/RBAC, user deletion/retention, asset operational statuses, all-metadata concurrency, or general CRUD idempotency.
- Approving one-day Employee Photo browser caching, silently assuming exact Cloudinary headers, or substituting permanent signed CDN URLs for expiring grants.
- Implementation tickets, feature code, production DB cleanup, provider account mutations, and deployment in the current spec-writing request.

## Further Notes

The selected public-asset / short-lived-employee policy follows the recorded architectural decision **Public asset images and short-lived profile-photo read links** and the domain glossary. It is a scoped exception to older general documentation saying all files require login; it does not make registry metadata public.

Ordinary employee portraits remain personal information. This spec records the product's accepted sharing risk, not a legal judgment that portraits are non-sensitive or that PDPA compliance is established. No image-content checks means the system cannot establish that an asset photo lacks people, documents, or screens in its background. Public exposure of accidentally included content is an accepted design trade-off.

The source is intentionally discarded after normalization: later increasing resolution/quality cannot reconstruct original detail. Quality 80 is an encoder setting, not 80% retained detail or a promised byte size. Long-lived public caches and already downloaded restricted photos are not revocable copies.

Free-tier suitability is a trial assumption, not a capacity/price guarantee. Measure uploads, stored bytes, provider verification/reconciliation requests, and photo deliveries against the actual account quota; avoid unnecessary transformation variants and repeated grants/downloads. Verify provider account settings rather than assuming every documented feature/header is enabled.

The next workflow is `/implement` Ticket 06 against the verified 2026-10-04 Backend handoff, then Ticket 07 in the approved isolated environment. G4 resolution and coordinated activation remain required before production release.
