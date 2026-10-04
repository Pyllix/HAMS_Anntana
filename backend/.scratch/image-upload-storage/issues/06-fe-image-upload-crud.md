# 06 — FE: อัปโหลดรูปใน Asset/User CRUD ด้วย Flow กลาง

**What to build:** ฟอร์ม Asset CRUD ปกติเลือกไฟล์และบันทึกผ่าน cloud-backed upload reference แทน Base64 และ ADMIN เพิ่ม/เปลี่ยน Employee Photo ผ่าน user create/edit ได้ โดยใช้ flow กลางร่วมกันและรักษารูปเดิมเมื่อปิดฟอร์มหรือบันทึกไม่สำเร็จ

**Blocked by:** [05 — BE: ตรวจครบและส่งมอบ Backend Contract ให้ FE](05-be-verification-and-handoff.md) — dependency complete วันที่ 2026-10-04 สำหรับ isolated FE development/acceptance; G4 ยังคงขวาง production release

**Owner / change boundary:** Frontend shared direct-upload/read helpers ที่ CRUD ต้องใช้ และ ordinary Asset/ADMIN User forms; ใช้ BE contract ที่ส่งมอบแล้ว ไม่รวม backend implementation ใหม่หรือ wait-disposal form

**Status:** in progress — FE implementation and local contract/regression checks are in place; isolated HAMS/Cloudinary form acceptance and code review remain pending.

## Implementation progress — 2026-10-04

- Added shared upload execution/read helpers and connected ordinary Asset create/edit plus ADMIN User create/edit forms to `imageUploadId`; Employee Photo current and pending bytes use the approved no-store memory-Blob policy.
- Added eleven focused image-flow tests for source limits/HEIC/HEIF, direct upload and verification, restricted photo reads, create/edit payloads, and lost-response recovery, plus two auth-state invalidation tests. Frontend suite passed 52/52; TypeScript source/test checks and production build passed.
- The frontend-to-isolated-Backend/Cloudinary form acceptance has not been run yet. This ticket remains in progress until that evidence and the required code review are recorded. Production activation stays blocked by G4.
- The current local Frontend proxy target is `hams-anntana.onrender.com`; the example identifies `hams-anntana-test.onrender.com` as the test backend. No form mutations were sent to the current target. Isolated form acceptance remains pending until a verified isolated Backend target is used.

**Approved environment:** ใช้ Backend process, PostgreSQL และ Cloudinary cloud สำหรับทดสอบที่แยกจากแอป/production พร้อมข้อมูลสังเคราะห์และ scoped cleanup เปิด `IMAGE_CRUD_ATTACHMENT_ENABLED=true` เฉพาะ process นี้ตาม [handoff baseline 2026-10-04](../../../docs/image-backend-handoff.md); production activation ยังคงปิดจนผ่าน G4 ห้าม deploy หรือใช้ลูกค้าจริงจากการปลด blocker นี้

**Source spec:** [Image upload storage specification](../spec.md) — Solution; Implementation Decisions 3, 5, 8–9; FE acceptance.

## Acceptance criteria

- [ ] ใช้ shared flow file selection→HAMS authorization→direct provider upload→complete verification→pending preview→CRUD save; HAMS requests ใช้ cookie/CSRF client เดิม ส่วนไฟล์ส่งตรง provider ไม่ผ่าน Render/API proxy
- [ ] ตัว executor ใช้ upload instructions จาก BE ไม่ hardcode signing secret, arbitrary provider transforms หรือ Cloudinary business logic ลงในแต่ละ form; future provider differences อยู่ที่ execution boundary ชัดเจน
- [ ] Ordinary asset create/edit เลิก persist canvas/Base64 Data URL และส่ง `imageUploadId` เฉพาะมี intended new photo; metadata-only edit omit image mutation field ไม่ส่ง old imageUrl ทับ current photo
- [ ] ADMIN user create/edit เลือก Employee Photo optional ได้ รวม create ก่อน target ID มีจริงและ create account ก่อนเพิ่มรูปทีหลัง; existing photo/add/replace ใช้ policy เดียว ไม่มี employee self-service หรือ remove button
- [ ] มี format/source-size feedback ตาม verified BE limits รวม HEIC/HEIF; ไม่ตัด input ด้วย `image/*` หรือ FE assumptions ที่ขัด contract และไม่บังคับ local HEIC conversion/canvas processing แทน provider
- [ ] Preview ภาพ normalized pending ผ่าน contract ของ BE; ใช้ shared read helper แสดง current Employee Photo ใน edit form ไม่มี public/permanent fallback และ no-photo ใช้ placeholder
- [ ] Employee Photo ทั้ง pending preview/current display โหลดผ่าน shared helper ด้วย `cache: 'no-store'`, request `Cache-Control: no-store`, `credentials: 'omit'`, bounded abort และการตรวจ URL/status/image content type แสดง Blob ใน memory พร้อม clear/revoke และป้องกัน stale async results; CORS failure ไม่ fallback ไปใส่ signed URL ตรงใน image element ตามมติ G2/[ADR 0005](../../../docs/adr/0005-employee-photo-cache-and-isolated-fe-handoff.md)
- [ ] Show uploading/verifying/saving/error states ชัดเจน ไม่ save unverified selection ไม่ silent drop intended photo แล้วรายงาน success และป้องกัน duplicate submit ที่หลบ upload/claim state
- [ ] Rapid file reselection ไม่ให้ stale async completion เปลี่ยน selection กลับ; abandoning pending selection ไม่ลบ current attachment และเหลือ lifecycle cleanup ให้ BE ตาม contract
- [ ] Cancel/close form หรือ failed CRUD save รักษารูปเดิมและ unsaved inputs ที่เหมาะสม; retry ใช้ verified pending reference เดิมใน window ได้ ส่วน expired/unusable upload แจ้งให้เลือก/อัปโหลดใหม่โดยไม่แอบ extend TTL
- [ ] Network response loss ใช้ upload outcome lookup เพื่อแยก committed save กับ failed save และกู้ original target ไม่ส่ง duplicate create หรือ superseded claim กลับไปแทน current image
- [ ] Session expiry หยุด mutation และรักษา draft เฉพาะแท็บ/บัญชีเดิมตาม auth policy; logout/account switch ล้าง pending form/grant state ป้องกันข้อมูลของอีกบัญชีถูก reuse โดยไม่ขยาย draft persistence
- [ ] ไม่ persist signed grant/provider authorization/preview ลง localStorage, persisted query/service-worker caches หรือ DB; memory/photo revision handling ใช้ shared helper ต่อได้ใน 07
- [ ] มี UI/API integration tests ทั้งสอง forms สำหรับ initial no-photo, create/add/replace/metadata-only edit, reselection/duplicate submit, upload/verify/save failure, cancel/retry/expiry, lost response และ role/session boundaries
- [ ] ทดสอบกับ verified BE baseline จาก 05 แล้ว ไม่เปลี่ยน wait-disposal form/checkbox/custody logic; ถ้าพบ backend defect ให้คืน ticket เจ้าของและตรวจ handoff ใหม่ ไม่ทำ BE fix แบบแฝงในใบ FE

## Handoff and boundaries

ส่ง shared upload/read/display primitives และ CRUD flows ที่ตรวจแล้วให้ 07 ย้าย display consumers อื่น ทดสอบผ่าน form ได้ครบในใบนี้ แต่ไม่อ้างว่ารูป user ทุกจุดในระบบ migrated ก่อนจบ 07

ใบนี้ complete ได้สำหรับ implementation/acceptance ในระบบทดสอบที่อนุมัติแล้ว โดย G4 ยังเปิดเป็น production release blocker ไม่เปิด activation จริงหรือแก้หน้ารอจำหน่ายเพื่อให้ integration tests ผ่าน
