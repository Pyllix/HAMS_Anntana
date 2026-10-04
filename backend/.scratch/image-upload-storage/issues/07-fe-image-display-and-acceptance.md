# 07 — FE: แสดงรูปทุกจุดและตรวจการใช้งานจริง

**What to build:** รูป asset/user ที่บันทึกแล้วแสดงถูกต้องในหน้าที่อยู่ใน scope รวม header/session user และ nested staff displays พร้อม expiry/account switch และ full acceptance ด้วยข้อมูลสังเคราะห์ในระบบทดสอบที่แยก ก่อนอนุญาต release/ทดลองกับลูกค้าจริงตาม G4

**Blocked by:** [06 — FE: อัปโหลดรูปใน Asset/User CRUD ด้วย Flow กลาง](06-fe-image-upload-crud.md). BE ผ่าน 05 สำหรับ isolated FE handoff วันที่ 2026-10-04; G4 ยังขวาง production release

**Owner / change boundary:** Frontend display consumers/shared photo helper และ full FE→BE acceptance/controlled trial; ไม่เพิ่ม backend behavior ใหม่หรือเปลี่ยน flow รอจำหน่าย

**Status:** implementation and automated verification progressed; isolated HAMS/Cloudinary/browser acceptance remains pending. Isolated test scope only.

## Implementation progress — 2026-10-04

- Inventoried asset image consumers and Employee Photo displays in Header, repair confirmation, user table, edit, detail, and delete views. Managed-photo views now use the shared display/read path; asset screens keep using Backend-provided versioned `imageUrl` values.
- Added account/user/revision-scoped in-memory grant reuse with expiry checks, no-store byte fetches, Blob object URLs, cleanup on unmount/session changes, and distinct missing/loading/error states. Auth-store login, pre-auth, and logout transitions synchronously clear the grant cache; a regression test verifies the next read requests a fresh grant. No provider URL is rendered directly in an image element.
- Asset saves invalidate asset list queries and refresh a matching open equipment/asset detail selection from the save response. Editing the signed-in user's photo also updates the session's photo presence/revision.
- Kept `WaitDisposalModal` and its image/custody behavior unchanged.
- Automated verification on 2026-10-04: Frontend suite 57/57 passed; source and test TypeScript checks passed; production build passed (existing >500 kB bundle warning remains).
- Full isolated FE→BE/browser acceptance remains pending. The current `front-end/.env.local` proxy target is production; the documented test backend is `https://hams-anntana-test.onrender.com`. No acceptance writes were sent to production.

**Source spec:** [Image upload storage specification](../spec.md) — Implementation Decisions 8–9; FE acceptance; G5/Further Notes.

## Acceptance criteria

- [x] Inventory และย้าย in-scope image consumers ให้ครบ: asset cards/lists/details ที่ใช้ imageUrl และ Employee Photo ใน header/session, user list/details/selectors หรือ nested staff views ที่พบจริง ไม่อ้างครบจากการแก้เฉพาะ CRUD forms
- [x] ใช้ shared photo-display helper จาก 06 ไม่ generate provider URLs ในแต่ละหน้า; managed-photo presence/revision อ่านจาก contract และแยก no-photo placeholder จาก authorization/provider error
- [ ] ทุก Employee Photo consumer รวม preview ใช้ no-store fetch/explicit request header และ Blob ใน memory ตาม G2 ไม่ใส่ signed provider URL ตรงใน image element; ตรวจ CORS ของ origin/browser จริงในระบบทดสอบ พร้อม status/content type, bounded abort และ revoke เมื่อเลิกแสดง โดยไม่อ้างว่า provider response header เปลี่ยนแล้ว
- [x] Asset display ใช้ stable versioned public URL ที่ BE ส่งมา ไม่ขอลิงก์ temporary ทุกครั้ง; replacement invalidate current app data ให้ revision/URL ใหม่แสดง โดยไม่ overwrite bytes ใต้ immutable URL
- [ ] Employee grant reuse อยู่ memory scoped current account/session + canonical image identity/revision มี expiry check ก่อน reuse; ID กับ employee-code reference resolve เป็น current photo เดียวกัน
- [x] หลัง expiry ขอ grant ใหม่เมื่อจำเป็นต้อง load รูป ไม่ polling/redownload รูปที่แสดงอยู่ทุก 5 นาที และไม่สร้าง infinite retry loop เมื่อ provider/network/auth มีปัญหา
- [ ] Logout/account switch/replacement ล้างหรือ invalidate scoped photo state; async response จาก session/revision เก่าไม่กลับมาแสดงรูปในบัญชี/รูปใหม่ และ session restore ใช้ photo presence/revision ไม่เชื่อ durable signed URL
- [x] ไม่ persist temporary grant/preview/provider authorization ใน browser persistent application storage; การล้าง memory ไม่อ้างว่าลบ HTTP cache หรือ downloaded bytes ได้
- [ ] หน้าที่ยังไม่มีรูปไม่แตก รองรับ seed fixture ตาม approved seed policy และไม่ทำ external unmanaged Employee Photo เป็น privacy fallback
- [ ] Full FE→BE acceptance ผ่าน create/add/replace/omit, white alpha/HEIC normalized preview, cancel, failed upload/verify/save, expired pending retry, response loss, two-editor last-save behavior และ superseded/abandoned cleanup
- [ ] Browser checks ครอบคลุม cookie/CSRF/session-expiry/account-switch, protected employee fresh-request expiry และ asset URL/revision cache behavior ตาม observed provider contract ไม่ใช้ displayed cached bytes เป็นหลักฐาน authorization
- [ ] ตรวจ regression ของ deferred wait-disposal caller ในระบบทดสอบโดยเว้นฟอร์ม รูป checkbox และ custody/repair logic; บันทึก selected Base64 photo บน managed Asset ที่ถูกปฏิเสธทั้งคำขอเป็น known G4 release blocker ไม่อ้างว่า migrated หรือ production-compatible แล้ว
- [ ] Controlled trial ใช้ disposable DB, separate test-only provider cloud และข้อมูลสังเคราะห์/known upload manifest; บันทึก actual upload/stored-byte/verification/reconciliation/delivery usage และข้อจำกัด ไม่ใช้ลูกค้าจริงหรือ mutate production จากขอบเขต isolated handoff นี้
- [ ] สรุป full in-scope FE acceptance ในระบบทดสอบให้ตรวจสอบได้ หากพบ BE defect ให้ reopen BE ticket เจ้าของและทบทวน 05 readiness ไม่ซ่อน backend feature/change ในใบนี้; ระบุ G4 production release blocker แยกและไม่ประกาศ feature released ขณะ gate ยังเปิด

## Completion boundary

ใบนี้จบด้วย implementation และ acceptance ของ feature asset/user ใน isolated scope ตาม [handoff](../../../docs/image-backend-handoff.md) ไม่รวม galleries, standalone removal, employee self-service, image-content review หรือการย้าย provider การปิดใบนี้ไม่เท่ากับ production release: ต้องผ่าน G4 และ coordinated release acceptance ก่อน deploy/activate หรือทดลองกับลูกค้าจริง การทดสอบไม่ได้รับรอง PDPA compliance หรือเรียกคืนรูปที่ผู้อื่นดาวน์โหลดไปแล้ว
