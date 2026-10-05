# 01 — BE: อัปโหลดและแปลงรูปผ่าน Storage Abstraction

**What to build:** ผู้มีสิทธิ์ขอ upload intent อัปโหลด Asset Image หรือ Employee Photo ตรงไป Cloudinary และยืนยันผลเป็นรูป pending ที่ตรวจแล้วได้ โดยยังไม่เปลี่ยนรูปบนทะเบียนหรือบัญชีและไม่ส่งไฟล์ผ่าน Render

**Blocked by:** None — can start immediately.

**Owner / change boundary:** Backend image application module, Storage Abstraction/Cloudinary adapter และการทดสอบของ flow อัปโหลด; ไม่แก้ Frontend หรือ business attachment ในใบนี้

**Status:** complete — 2026-10-02; G1 live-provider, authenticated API, adapter regression, and cleanup evidence verified.

**Source spec:** [Image upload storage specification](../spec.md) — Implementation Decisions 1–5, 7; Testing Decisions/G1.

## Acceptance criteria

- [x] มี Storage port ขนาดเล็กที่แยก provider signing, normalization/verification, delivery และ deletion ออกจาก business logic พร้อม Cloudinary adapter และ deterministic test fake; ไม่สร้าง S3/R2 adapter หรือ universal file framework เพิ่ม
- [x] ทำ prefactoring เฉพาะที่จำเป็นก่อนเพิ่มพฤติกรรม และเพิ่ม schema/tracking ด้วย Prisma migrations อย่าง additive โดยไม่ reset DB หรือเปลี่ยน API อื่นที่ไม่เกี่ยวข้อง
- [x] `POST /images/uploads` ตรวจ cookie/session/CSRF/2FA/RBAC ตามระบบเดิม; Asset Image ใช้สิทธิ์ ADMIN, ASSET_CENTER_STAFF, PARCEL_STAFF ส่วน Employee Photo เป็น ADMIN เท่านั้น รวม ADMIN ที่จัดการรูปของตนเอง
- [x] Persist intent ก่อนคืน signed direct-upload instructions พร้อม purpose, uploader, canonical target ID หรือ server-recognized creation context, policy revision, unique allocated key และ deadlines; รองรับสร้าง record ก่อนมี target ID โดยไม่ใช้ email/filename เป็นหลักฐาน ownership
- [x] BE เป็นผู้กำหนดและลงนาม policy/key/preset ที่อนุญาต ป้องกัน overwrite และ arbitrary parameter signing; จำกัด intent/retry ต่อ actor/environment แบบ configurable ไม่เปิด unsigned upload เป็นทางลัด
- [x] Browser/test client ส่งไฟล์ตรง Cloudinary; HAMS รับเฉพาะ metadata/evidence ไม่รับ image body, Base64, arbitrary URL fetch, image processing หรือ persistent local image storage
- [x] `POST /images/uploads/:uploadId/complete` และ `GET /images/uploads/:uploadId` ตรวจ owner/current permission และ verify known allocated object จาก trusted provider information; forged URL/signature/metadata, wrong purpose/target/environment/resource/delivery type ไม่กลายเป็น verified pending upload
- [x] Completion ที่ retry ด้วยผลเดิมเป็น idempotent ไม่สร้าง object ใหม่หรือยืด deadline; upload status อธิบาย lifecycle/outcome ได้โดยไม่เปิดเผยข้อมูลของ uploader อื่น และมี stable machine-readable errors ตาม contract
- [x] ใช้ policy ต้นฉบับ JPEG, PNG, static WebP, HEIC/HEIF still image และเพดาน 10,000,000 bytes ทั้งสอง purpose; พิสูจน์ enforcement ของ source จริง ไม่อาศัย extension/MIME/FE declaration หรือ output JPEG เพียงอย่างเดียว
- [x] Incoming processing เก็บ JPEG หนึ่งไฟล์ quality 80; Asset Image longest edge ไม่เกิน 1,600 px และ Employee Photo ไม่เกิน 512 px รักษาสัดส่วน ไม่ crop/upscale และไม่เก็บ unchanged source/eager variants เพิ่ม
- [x] Flatten alpha เป็นพื้นขาวโดยไม่เปลี่ยน opaque background; apply orientation ก่อน strip metadata และตรวจ actual output รวม semi-transparent edges, rotation/mirroring และ color behavior
- [x] ใช้ explicit incoming metadata stripping เอา GPS/camera/capture และ unnecessary EXIF/IPTC/XMP ออก พร้อมบันทึก provider-preserved provenance exception ไม่สัญญาว่าทุก tag หาย; ตรวจ backup/revision settings ไม่สร้าง history โดยไม่ตั้งใจ
- [x] Asset Image ใช้ public image delivery และ Employee Photo ใช้ `authenticated` ตั้งแต่อัปโหลด ครอบคลุม originals/derivatives; ไม่ออก permanent Employee Photo grant เพื่ออุดช่อง preview ที่ยังไม่ทำในใบนี้
- [x] Configuration/credentials อยู่ BE เท่านั้น; missing/invalid configuration แสดง failure ชัดเจน ไม่ fallback เป็น public Employee Photo, Base64, local disk หรือ unmanaged URL; responses ที่มี authorization/private upload data เป็น `private, no-store` และ logs ไม่เก็บ secret/full signed links
- [x] มี HTTP acceptance tests ใช้ production DTO/guards และ fake provider สำหรับ success/denial/forged evidence/outage/idempotency; ใช้ clock ที่ควบคุมได้และ dedicated test DB เมื่อทดสอบ durability ไม่อ้าง mock เป็น transaction proof
- [x] มี opt-in real-Cloudinary fixtures/test evidence สำหรับ G1: HEIC/HEIF, format/static-image/size bypass attempts, corrupted/multiple-frame inputs, transformations/metadata/color, actual source pixel/account limits และ signed-policy/result verification
- [x] ถ้ายังไม่มี credentials หรือ source enforcement/normalization ไม่ตรง spec ให้บันทึก gap และตรวจทางแก้ที่อยู่ในขอบเขต ไม่ปิด ticket ว่าพิสูจน์ G1 แล้วจาก fake tests อย่างเดียว และไม่ลด validation/เปลี่ยนไปประมวลผลบน Render โดยไม่ได้รับมติ

## Handoff and boundaries

ส่งมอบ API/DTO/error contract และ verified pending reference ให้ 02 ใช้ การออก pending preview เป็นของ 03 ส่วนการล้างจริงเป็นของ 04; ใบนี้ต้องเก็บ known allocated identity/deadlines ให้สองใบนั้นใช้ต่อได้ รูปอัปโหลดเสร็จอย่างเดียวไม่ถือว่าผูกกับ record และไม่มี UI/self-service/remove action ใหม่

## Implementation progress (2026-10-01)

- Added the backend Storage Abstraction, Cloudinary adapter, upload policy, upload-intent persistence, and the direct-upload/complete/status API. No Frontend or Asset/User CRUD integration was included.
- Added additive Prisma migrations for upload tracking and bounded completion-verification attempts; migrations were applied to the confirmed test database without resetting it.
- Added API integration coverage with real HAMS authentication, CSRF, 2FA, RBAC, and PostgreSQL using a deterministic fake storage provider; added adapter unit tests and an opt-in real-Cloudinary contract suite.
- Verification: `pnpm exec tsc --noEmit` passed; the image-upload API integration suite passed (11 tests) on a new disposable PostgreSQL database synchronized from the current Prisma schema; targeted ESLint passed.
- Jest reports an existing asynchronous open handle after both successful test runs; each process exited with code 0.
- G1 remains unverified: the opt-in Cloudinary suite was not run because an isolated test-only Cloudinary account and its synthetic fixture pack have not been confirmed. Do not treat fake-provider tests as proof of Cloudinary source enforcement, HEIC/HEIF handling, or actual transformation output. Keep this ticket in progress until those real-provider checks pass or the gap is resolved within the agreed scope.
- Code-review fixes: Employee Photo upload instructions now use the authenticated REST endpoint, object deletion names resource/delivery type in the Admin API path, and the source policy rejects multi-frame inputs through `nb_frames`. The opt-in contract suite now decodes output JPEGs and checks orientation, mirroring, alpha flattening, color, dimensions, and stripped metadata against synthetic sources. Updated the stale environment comment and consolidated configuration-error translation.
- Follow-up verification: adapter unit tests 6/6, image-upload API integration tests 11/11, TypeScript, targeted ESLint, and frozen-lockfile install passed. The real Cloudinary suite compiled and remained skipped without opt-in; G1 still requires a separate test-only cloud account and the complete synthetic fixture pack before this ticket can be marked complete.
- Follow-up verification (2026-10-02): generated and locally validated the 18-image synthetic Cloudinary fixture pack; adapter unit tests passed 6/6 and authenticated API integration tests passed 11/11 against the disposable local test database. `pnpm exec tsc --noEmit`, targeted TypeScript ESLint, and `node --check scripts/prepare-cloudinary-fixtures.mjs` passed. At this point the isolated Cloudinary test credentials were not yet configured; see the live-provider verification below for the later G1 run.
- Live-provider verification (2026-10-02): ran the opt-in G1 suite against the separate test-only Cloudinary environment with all 18 fixtures; 16 tests passed and 4 failed. Cloudinary rejected both the HEIC and HEIF accepted fixtures; the oversized-source rejection case timed out; and Cloudinary accepted the same signed upload fields when the request path was changed from `image/upload` to `raw/upload`. These results do not satisfy G1 and must not be treated as a passing ticket. The suite's cleanup hook completed without reporting failures, and a read-only Admin API check found zero remaining `hams-contract-` objects in image, raw, and video resources. Investigate provider-enforceable source restrictions and HEIC/HEIF/account behavior before closing; do not weaken the policy based on these failures.
- Diagnosis (2026-10-02): [targeted live evidence and remediation plan](../diagnostics/g1-findings.md) confirmed `/image/authenticated` returns 404 even for JPEG; `/image/upload` with a signed `type=authenticated` accepts JPEG and HEIC and protects their reads. The HEIF fixture uses unsupported `mif3` minimized headers; a conventional HEIF container succeeds. Separate probes enforce the exact 10,000,000-byte cap, and the original large fixture now returns an account-limit error rather than timing out. Cloudinary excludes resource type from signatures; HAMS rejects raw-only objects, including an exact-ID raw case, while Ticket 04 already requires reconciliation of raw aliases. Correct the endpoint/signed type, fixtures, and raw/size test assertions, then rerun full G1; the diagnostic candidate is not a production fix or a passing full suite. All diagnostic cleanup checks reported zero remaining scoped objects.

## Fix and final verification (2026-10-02)

- Regression-first: updated endpoint/type assertions failed on the old implementation (1 failed / 5 passed), then passed after fixing `/image/upload` and signing the purpose-specific `type`. Unit signature checks prove that changing `authenticated` to `upload` changes the expected signature; live tampering returns 401.
- Signed `backup=false` explicitly prevents backup copies; `overwrite=false`, unique intent keys, and no eager transforms avoid accidental revisions/extra variants.
- Replaced the unsupported minimized-header HEIF sample with a pinned, valid HEVC-in-HEIF still container tested under both HEIC/HEIF filename and MIME aliases. Both require Sharp decoding and single-page validation. This does not claim every HEIF codec/header variant is accepted.
- Regenerated all 18 synthetic fixtures. The oversized valid JPEG is 10,174,213 bytes, above the decimal HAMS cap and below the provider's 10 MiB account cap. Source rejection assertions require 4xx, not transport timeouts or provider outages.
- Added independent Employee Photo JPEG coverage and raw-only completion rejection with both suffixed and exact allocated IDs. Provider namespace limitations do not weaken trusted image verification; Ticket 04 must still reconcile alternate raw identities through bounded intent-scoped probes.
- Final live Cloudinary run: **23/23 tests passed**, exit 0, including cleanup (137.667 seconds). An intermediate run passed all test cases but failed four parallel cleanup requests; teardown now deletes recorded identities sequentially with bounded retries. The four test-only leftovers were deleted, and a final read-only check found **zero** `hams-contract-` objects across image/raw/video and upload/authenticated delivery types.
- Adapter unit suite: **6/6 passed**. Authenticated HAMS API integration with fake provider and disposable PostgreSQL: **11/11 passed**, exit 0. TypeScript, targeted ESLint, fixture script syntax, and diff whitespace checks passed. The API suite still reports an asynchronous open-handle warning before exiting successfully.
- Original minimized Employee Photo regression now returns upload 200, trusted verification success, anonymous read 401, authorized read 200, JPEG 512×384, no EXIF; diagnostic cleanup reported zero remaining objects.
- Updated [API handoff documentation](../../../docs/image-uploads-api.md). No Frontend changes, commit, or push. Ticket 02 is the next dependency; preview/cache and production cleanup remain Tickets 03/04, and full BE handoff remains Ticket 05.
