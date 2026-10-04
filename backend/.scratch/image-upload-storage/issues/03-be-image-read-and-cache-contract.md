# 03 — BE: เปิดดูรูปและกำหนด Read/Cache Contract

**What to build:** ผู้มี Asset Image URL เปิดรูปได้โดยไม่ล็อกอิน ส่วนผู้ผ่าน HAMS auth/access guards ขอ Employee Photo ด้วยลิงก์หมดอายุ 5 นาทีได้ พร้อม pending preview เฉพาะ uploader และ contract ที่แยก no-photo, outage, expiry และ caching ได้ชัดเจน

**Blocked by:** [02 — BE: เพิ่มและเปลี่ยนรูปผ่าน Asset/User CRUD อย่างปลอดภัย](02-be-crud-image-attachment.md).

**Owner / change boundary:** Backend image read/preview APIs, user/list/session projections และ Cloudinary read/cache verification; ไม่ทำ FE display integration ในใบนี้

**Status:** complete — 2026-10-04; Backend/provider evidence verified and scoped Employee Photo no-store policy approved.

**Verification:** On 2026-10-03, the focused HTTP acceptance suite passed 17/17 against isolated PostgreSQL. The separate real-Cloudinary G2 case passed 1/1 with exit 0 and scoped teardown, observing public Asset delivery, restricted Employee originals/derivatives, valid grants, fresh expiry denial, and actual byte headers. The 2026-10-04 Backend audit again passed image HTTP 17/17, build/TypeScript, and 450/450 units. The user accepted public versioned Asset caching for 30 days and, on 2026-10-04, approved direct-browser Employee retrieval with Fetch no-store, explicit request no-store, and session-memory Blob display, proven feasible in isolated Edge. Employee success still returns `public, max-age=2592000`; this is an accepted limitation of the scoped request policy, not a provider header override. See [G2 evidence and decision](../../../docs/image-read-g2-verification.md). Actual Frontend helper/lifecycle acceptance belongs to 06/07 and is not marked complete here.

**Source spec:** [Image upload storage specification](../spec.md) — Implementation Decisions 1, 5, 8; Testing Decisions/G2.

## Acceptance criteria

- [x] Asset Image มี BE-derived stable versioned HTTPS public CDN URL; anonymous URL holder เปิดได้ และ replacement ใช้ object/URL ใหม่ ไม่ overwrite immutable content เดิม; registry metadata/mutation APIs ยังคง auth
- [x] `GET /users/:id/photo` ใช้ current attached Employee Photo และ canonical user lookup ตาม ID/employee code พร้อม normal visibility rules; ผู้ผ่าน auth/access guards ทุก role ขอรูปคนอื่นได้โดยไม่เพิ่ม owner/ADMIN-only read policy
- [x] Employee Photo grant default 5 นาที configurable มี actual `expiresAt` และ opaque revision; ใช้ provider-enforced time-limited download บน `authenticated` type ไม่ substitute permanent signed CDN URL
- [x] Protect Employee Photo originals/derivatives และไม่ expose public/permanent fallback ใน DTO, session, CRUD response, preview หรือ error; unsigned/public path ไม่ได้รูปผ่านการเดา locator
- [x] `GET /images/uploads/:uploadId/preview` คืนผลเฉพาะ verified live pending upload ของ authorized uploader ที่ยังมี mutation permission; employee preview restricted grant ส่วน asset bytes ยังเป็น public ตาม policy แม้ preview API ถูกจำกัด
- [x] User/list/session projections มี consistent `hasEmployeePhoto`/`photoRevision` และ no-photo semantics; managed Employee Photo durable `imageUrl` null ไม่เก็บ temporary URL ใน User/BetterAuth/session cache และไม่ generate grant ให้ทุก nested/list user โดยอัตโนมัติ
- [x] API errors แยก no-photo, unauthorized, expired pending และ retryable provider outage โดยไม่เผย secret/grant ของผู้อื่น; photo response failure หลัง successful CRUD commit ไม่อ้างว่า business transaction rollback
- [x] Upload/status-private-data/preview/grant responses และ relevant errors ใช้ `Cache-Control: private, no-store`; endpoint อื่นที่ embed grant ถ้ามีต้องใช้ policy เดียวและไม่ผ่าน shared application/server cache
- [x] ตรวจ actual Cloudinary image success/error Cache-Control และบันทึกความต่าง: Asset success เป็น `public, no-transform, immutable, max-age=2592000` ไม่ใช่ desired one-year; signed Employee Photo success เป็น `public, max-age=2592000` โดยมติใช้ no-store อยู่ที่คำขอโหลดผ่าน HAMS ไม่อ้างว่า provider response เปลี่ยนแล้ว
- [x] HTTP acceptance tests พิสูจน์ read scope, pending-owner protection, current revision/no-photo, metadata/session no credential persistence, auth denial และ no-store headers
- [x] Opt-in real-Cloudinary G2 test พิสูจน์ public asset path และ restricted originals/derivatives, grant ก่อนหมดอายุใช้งานได้ และ fresh cache-bypassed request หลัง expiry ล้มเหลว; มี shortened-TTL timing check และ default 5-minute check แยก ไม่อ้าง cached displayed image เป็น expiry proof
- [x] Logout/revoke หยุด future grant issuance แต่ prior bearer grant อาจใช้ได้จน expiry ตาม risk ที่ยอมรับ; tests/docs ไม่สัญญาว่าลบ cached/downloaded bytes ได้
- [x] บันทึกมติผู้ใช้ 2026-10-04: Employee Photo ใช้ direct fetch แบบ `cache: 'no-store'` พร้อม request `Cache-Control: no-store`, `credentials: 'omit'` และ Blob ใน memory; ยอมรับข้อจำกัดว่า provider header ยังเป็น `public` 30 วันและ copied URL/downloaded bytes อยู่นอกคำสั่งของ helper ไม่ proxy bytes ผ่าน Render; implementation/UI acceptance อยู่ 06/07

## Handoff and boundaries

ส่ง response/error/expiry/revision contract ให้ shared FE helper ใน 06–07 ใช้ Grant-response headers ไม่ควบคุม separate Cloudinary byte response และ backend completion ไม่ใช่ข้ออ้างให้ generate/read grants รอบละ 5 นาทีใน FE
