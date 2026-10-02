# 07 — FE: แสดงรูปทุกจุดและตรวจการใช้งานจริง

**What to build:** รูป asset/user ที่บันทึกแล้วแสดงถูกต้องในหน้าที่อยู่ใน scope รวม header/session user และ nested staff displays พร้อมการจัดการ expiry/account switch และ flow ทดลองกับลูกค้าที่ผ่าน acceptance ครบ

**Blocked by:** [06 — FE: อัปโหลดรูปใน Asset/User CRUD ด้วย Flow กลาง](06-fe-image-upload-crud.md). BE ทั้งหมดผ่าน 05 ก่อนหน้าแล้ว

**Owner / change boundary:** Frontend display consumers/shared photo helper และ full FE→BE acceptance/controlled trial; ไม่เพิ่ม backend behavior ใหม่หรือเปลี่ยน flow รอจำหน่าย

**Status:** ready-for-agent

**Source spec:** [Image upload storage specification](../spec.md) — Implementation Decisions 8–9; FE acceptance; G5/Further Notes.

## Acceptance criteria

- [ ] Inventory และย้าย in-scope image consumers ให้ครบ: asset cards/lists/details ที่ใช้ imageUrl และ Employee Photo ใน header/session, user list/details/selectors หรือ nested staff views ที่พบจริง ไม่อ้างครบจากการแก้เฉพาะ CRUD forms
- [ ] ใช้ shared photo-display helper จาก 06 ไม่ generate provider URLs ในแต่ละหน้า; managed-photo presence/revision อ่านจาก contract และแยก no-photo placeholder จาก authorization/provider error
- [ ] Asset display ใช้ stable versioned public URL ที่ BE ส่งมา ไม่ขอลิงก์ temporary ทุกครั้ง; replacement invalidate current app data ให้ revision/URL ใหม่แสดง โดยไม่ overwrite bytes ใต้ immutable URL
- [ ] Employee grant reuse อยู่ memory scoped current account/session + canonical image identity/revision มี expiry check ก่อน reuse; ID กับ employee-code reference resolve เป็น current photo เดียวกัน
- [ ] หลัง expiry ขอ grant ใหม่เมื่อจำเป็นต้อง load รูป ไม่ polling/redownload รูปที่แสดงอยู่ทุก 5 นาที และไม่สร้าง infinite retry loop เมื่อ provider/network/auth มีปัญหา
- [ ] Logout/account switch/replacement ล้างหรือ invalidate scoped photo state; async response จาก session/revision เก่าไม่กลับมาแสดงรูปในบัญชี/รูปใหม่ และ session restore ใช้ photo presence/revision ไม่เชื่อ durable signed URL
- [ ] ไม่ persist temporary grant/preview/provider authorization ใน browser persistent application storage; การล้าง memory ไม่อ้างว่าลบ HTTP cache หรือ downloaded bytes ได้
- [ ] หน้าที่ยังไม่มีรูปไม่แตก รองรับ seed fixture ตาม approved seed policy และไม่ทำ external unmanaged Employee Photo เป็น privacy fallback
- [ ] Full FE→BE acceptance ผ่าน create/add/replace/omit, white alpha/HEIC normalized preview, cancel, failed upload/verify/save, expired pending retry, response loss, two-editor last-save behavior และ superseded/abandoned cleanup
- [ ] Browser checks ครอบคลุม cookie/CSRF/session-expiry/account-switch, protected employee fresh-request expiry และ asset URL/revision cache behavior ตาม observed provider contract ไม่ใช้ displayed cached bytes เป็นหลักฐาน authorization
- [ ] Deferred wait-disposal caller regression ตรงกับ separately approved isolation/cutover จาก 05 โดยไม่แก้ฟอร์ม รูป checkbox หรือ custody/repair logic และไม่สรุปว่า deferred caller migrated แล้ว
- [ ] Controlled trial มี test data/known upload manifest และบันทึก actual upload/stored-byte/verification/reconciliation/delivery usage พร้อม known limitations; ไม่ใช้ production customer images หรือ mutate live environment โดยไม่ได้รับ authority ที่เหมาะสม
- [ ] สรุป full feature acceptance ให้ตรวจสอบได้ หากพบ BE defect ให้ reopen BE ticket เจ้าของและทบทวน 05 readiness ไม่ซ่อน backend feature/change ในใบนี้; ไม่ประกาศพร้อมส่งมอบถ้ายังมี required acceptance/gate ค้าง

## Completion boundary

ใบนี้จบด้วย feature asset/user ที่ใช้ได้จริงตาม scope ไม่รวม galleries, standalone removal, employee self-service, image-content review หรือการย้าย provider การทดสอบไม่ได้รับรอง PDPA compliance หรือเรียกคืนรูปที่ผู้อื่นดาวน์โหลดไปแล้ว
