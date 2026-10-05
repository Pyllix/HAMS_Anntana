# Image upload storage — implementation ticket map

**Source spec:** [Asset Image and Employee Photo — Cloudinary with Storage Abstraction](spec.md)

**Status — 2026-10-05:** Backend Tickets 01–05 are complete for the recorded handoff scope. Frontend 06–07 are implemented with automated checks; the user reports successful manual image addition against real Cloudinary. Full acceptance across failure/retry, expiry, session/account changes, and replacement remains incompletely recorded, and the latest changes need final review and commit. G4 remains the deferred wait-disposal compatibility decision for production release. Not pushed.

**Delivery rule:** ทำ BE 01–05 ให้เสร็จทั้งหมดและผ่าน BE handoff gate ก่อนเริ่ม FE 06–07 ตามคำขอของผู้ใช้วันที่ 2026-10-01

## หลักการแบ่งงาน

- ยืนยัน 7 tickets: BE 5 ใบ และ FE 2 ใบ รวมงานที่ใช้ flow/กลไกร่วมกัน ไม่แยก DTO, schema, adapter หรือ test เป็น ticket ย่อยคนละใบ
- แต่ละ ticket ส่งมอบพฤติกรรมที่ตรวจได้ พร้อมการทดสอบของตัวเอง BE ตรวจผ่าน HTTP API/ฐานข้อมูลทดสอบและ Cloudinary จริงที่เกี่ยวข้อง โดยไม่ต้องรอ UI; FE ตรวจผ่าน flow หน้าจอหลัง BE พร้อมแล้ว
- การแยก BE ก่อน FE เป็นข้อกำหนดของผู้ใช้ จึงไม่บังคับให้แต่ละ slice เปลี่ยน UI ไปพร้อมกัน
- Prefactoring ที่จำเป็นและมีขอบเขตเล็กทำก่อนเพิ่มพฤติกรรมภายใน ticket เจ้าของงาน ไม่เพิ่ม ticket refactor กว้างโดยไม่มีเหตุผล
- เผยแพร่ Markdown หนึ่งไฟล์ต่อ ticket ใต้ `issues/` เรียง 01–07 พร้อม What to build, Blocked by, Owner, Status `ready-for-agent` และ acceptance checklist; map นี้เป็นสารบัญ ไม่ใช่ไฟล์รวมแทน ticket รายใบ
- Blocked by เป็นเงื่อนไขเริ่มงานจริง ไม่ใช่เพียงลำดับเลข; `ready-for-agent` ไม่หมายความว่าเริ่มได้ทั้งที่ blocker ยังไม่เสร็จ

## Tickets

| ID | Owner | Ticket | Blocked by |
| --- | --- | --- | --- |
| 01 | BE | [อัปโหลดและแปลงรูปผ่าน Storage Abstraction](issues/01-be-direct-upload-and-normalization.md) | None |
| 02 | BE | [เพิ่มและเปลี่ยนรูปผ่าน Asset/User CRUD อย่างปลอดภัย](issues/02-be-crud-image-attachment.md) | 01 |
| 03 | BE | [เปิดดูรูปและกำหนด Read/Cache Contract](issues/03-be-image-read-and-cache-contract.md) | 02 |
| 04 | BE | [ล้างรูปค้างและรูปเก่า พร้อมกู้หลัง Restart](issues/04-be-image-cleanup-and-recovery.md) | 02 |
| 05 | BE | [ตรวจครบและส่งมอบ Backend Contract ให้ FE](issues/05-be-verification-and-handoff.md) | 03, 04 |
| 06 | FE | [อัปโหลดรูปใน Asset/User CRUD ด้วย Flow กลาง](issues/06-fe-image-upload-crud.md) | 05 |
| 07 | FE | [แสดงรูปทุกจุดและตรวจการใช้งานจริง](issues/07-fe-image-display-and-acceptance.md) | 06 |

## Approved delivery scopes

1. **01 — BE: อัปโหลดและแปลงรูปผ่าน Storage Abstraction**
   - **Blocked by:** None — can start immediately.
   - **What it delivers:** ผู้มีสิทธิ์ขอ upload intent อัปโหลดตรง Cloudinary และยืนยันเป็นรูป pending ที่ตรวจแล้วได้ ทั้ง Asset Image และ Employee Photo โดยไม่ส่งไฟล์ผ่าน Render
   - **รวมในใบเดียว:** Storage port/Cloudinary adapter, configuration, upload tracking/migrations ที่จำเป็น, authorization/complete/status API, purpose/owner/target binding, normalization และชุดทดสอบ HTTP/real-provider สำหรับพฤติกรรมนี้
   - **ต้องพิสูจน์:** input policy 10,000,000 bytes และชนิดไฟล์ต้นฉบับ, HEIC/HEIF, JPEG quality 80, longest edge 1,600/512, orientation/alpha/metadata/color และ provider/account limits ตาม G1 ห้ามอ้าง output JPEG เป็นหลักฐาน source validation
   - **ขอบเขต:** ยังไม่ผูกกับ business record และยังไม่ทำ UI; completion ไม่เปลี่ยนรูปปัจจุบัน

2. **02 — BE: เพิ่มและเปลี่ยนรูปผ่าน Asset/User CRUD อย่างปลอดภัย**
   - **Blocked by:** 01 — อัปโหลดและแปลงรูปผ่าน Storage Abstraction.
   - **What it delivers:** เพิ่มหรือเปลี่ยนรูปหนึ่งรูปผ่านการบันทึก CRUD เดิมได้ รวมการสร้างบัญชีพร้อมรูปก่อนมี target ID และการเพิ่มรูปทีหลัง
   - **รวมในใบเดียว:** record-level locator/URL metadata, transactional upload claim, ADMIN/purpose-specific RBAC recheck, failed-save/user-create compensation, outcome recovery, last-successful-save-wins, superseded cleanup eligibility และ HTTP/real-DB concurrency tests
   - **ต้องพิสูจน์:** omission รักษารูปปัจจุบัน; null/empty ไม่ลบรูป; retry ไม่คืนรูปที่ถูกแทนแล้ว; A→B→C ระบุรูปเก่าจริงทั้ง A/B ได้; ไม่มี provider network/delete ใน DB transaction
   - **ขอบเขต:** เพิ่ม contract อย่างระมัดระวัง ไม่เลือก legacy Base64 exception หรือเปลี่ยนรอจำหน่ายเอง การเปิดใช้ shared write contract ต้องผ่าน gate ใน 05

3. **03 — BE: เปิดดูรูปและกำหนด Read/Cache Contract**
   - **Blocked by:** 02 — เพิ่มและเปลี่ยนรูปผ่าน Asset/User CRUD อย่างปลอดภัย.
   - **What it delivers:** เปิด Asset Image ผ่าน public versioned URL และขอ Employee Photo ผ่านลิงก์หมดอายุ 5 นาที พร้อม preview ของ pending upload เฉพาะ uploader
   - **รวมในใบเดียว:** photo/preview API, user/list/session presence/revision DTO, authenticated original/derivative protection, error/no-photo semantics, private/no-store API headers และ real-provider expiry/header tests ตาม G2
   - **ต้องพิสูจน์:** ผู้ผ่าน auth/access guards ขอรูปพนักงานคนอื่นได้; ไม่เก็บ temporary URL ใน DB/BetterAuth cache; fresh cache-bypassed request ใช้ลิงก์หลังหมดอายุไม่ได้; ตรวจ Cache-Control ของ Cloudinary จริงและบันทึกความต่างจากค่าที่ต้องการ
   - **ขอบเขต:** ไม่ใช้ permanent signed CDN URL แทน expiring grant ไม่เปิด public Employee Photo และไม่เพิ่ม Render byte proxy

4. **04 — BE: ล้างรูปค้างและรูปเก่า พร้อมกู้หลัง Restart**
   - **Blocked by:** 02 — เพิ่มและเปลี่ยนรูปผ่าน Asset/User CRUD อย่างปลอดภัย.
   - **What it delivers:** รูปไม่ผูกที่หมด attachment window 1 ชั่วโมงและรูปที่ถูกแทนเข้าสู่การล้างที่ปลอดภัย งานค้างกลับมาทำต่อได้หลัง BE หลับ/restart/provider ล่ม
   - **รวมในใบเดียว:** durable cleanup/reconciliation, bounded startup/interval sweeps, leases/backoff/request budgets, live-reference/claim coordination, late/unreported upload handling, sanitized operational logs และ API/real-DB/provider recovery tests ตาม G3
   - **ต้องพิสูจน์:** ไม่ลบรูปที่ยังอ้างอิงรวมถึง soft-deleted user ที่ยัง restore ได้; provider not-found เป็นผลสำเร็จ; replay/late upload ไม่หนี tracking; cleanup failure ไม่ย้อน CRUD; TTL ไม่ใช่สัญญาว่าลบจริงตรงเวลาเมื่อ Render หลับ
   - **ขอบเขต:** ไม่เพิ่ม paid worker/cron, Redis, image history หรือ standalone remove endpoint และไม่ลบ seed URL ที่ไม่มี trusted locator

5. **05 — BE: ตรวจครบและส่งมอบ Backend Contract ให้ FE**
   - **Blocked by:** 03 — เปิดดูรูปและกำหนด Read/Cache Contract; 04 — ล้างรูปค้างและรูปเก่า พร้อมกู้หลัง Restart. งาน 01–02 ต้องเสร็จผ่าน dependency ก่อนหน้าอยู่แล้ว
   - **What it delivers:** BE ทั้ง feature พร้อมให้ FE เริ่มใช้งานด้วย API contract/configuration checklist และหลักฐานทดสอบที่ตรวจสอบได้ ไม่เหลืองาน BE ให้ไปซ่อนใน FE tickets
   - **รวมในใบเดียว:** regression/API integration ตลอด upload→claim→read→replace→cleanup, สรุปผล G1–G3, API reference/error examples, seed policy/targeted test-residue cleanup procedure, caller inventory และ shared-contract rollout/handoff ตาม G4–G5
   - **ต้องพิสูจน์:** ทดสอบ Cloudinary จริง ไม่ปิดงานเพียงเพราะ fake provider ผ่าน; จัดการ shared Base64 caller โดยพิสูจน์ isolation ที่ปลอดภัยหรือมีมติ integration/cutover ที่อนุมัติแยกไว้; ระบุ sequencing เปิดใช้งานโดยไม่บังคับเปลี่ยน FE ก่อน BE เสร็จ
   - **External gates:** credentials/account support, source enforcement หรือ cache limitations ที่ยังไม่พิสูจน์ และมติ shared-contract ที่อาจกระทบรอจำหน่าย ต้องระบุเป็น blocker ที่มองเห็นได้ ห้ามสมมติผลสำเร็จหรือเลือก exception แทนผู้ใช้
   - **ขอบเขต:** ไม่แก้ฟอร์มรอจำหน่าย checkbox หรือ repair/custody logic; ไม่ทำ production DB reset หรือ account mutation โดยไม่มีอำนาจที่เหมาะสม

6. **06 — FE: อัปโหลดรูปใน Asset/User CRUD ด้วย Flow กลาง**
   - **Blocked by:** 05 — ตรวจครบและส่งมอบ Backend Contract ให้ FE.
   - **What it delivers:** ฟอร์ม Asset ปกติเลิกส่ง Base64 และ ADMIN เพิ่ม/เปลี่ยน Employee Photo ใน create/edit ได้ พร้อม preview และบันทึกผ่าน upload reference
   - **รวมในใบเดียว:** shared direct-upload/read client/helpers ที่ฟอร์มต้องใช้, ทั้งสอง CRUD forms, file feedback/loading/reselection, optional/no-photo state, save/retry/expired-upload/lost-response recovery, session/draft-safe handling และ UI integration tests
   - **ต้องพิสูจน์:** อัปโหลดไม่เท่ากับบันทึก; ปิดฟอร์มหรือ save ไม่สำเร็จไม่ทำรูปเดิมหาย; metadata-only edit ไม่ส่ง stale image; ไม่ persist grant/preview หรือ expose self-service/remove controls; เรียก HAMS ผ่าน cookie/CSRF client เดิม แต่ส่งไฟล์ตรง provider
   - **ขอบเขต:** ยังไม่ย้ายทุก display consumer ของระบบ และไม่แตะ wait-disposal form

7. **07 — FE: แสดงรูปทุกจุดและตรวจการใช้งานจริง**
   - **Blocked by:** 06 — อัปโหลดรูปใน Asset/User CRUD ด้วย Flow กลาง; BE ทั้งหมดผ่าน 05 แล้ว
   - **What it delivers:** รูป asset/user ที่บันทึกแล้วแสดงถูกต้องในหน้าที่อยู่ใน scope รวม header/session user และ nested staff displays พร้อม flow ทดลองส่งให้ลูกค้าดูได้
   - **รวมในใบเดียว:** ย้าย consumer ไป shared display helper, session+revision-scoped memory reuse/expiry-on-next-load, logout/account-switch invalidation, placeholders/provider errors และ full FE→BE acceptance/controlled trial
   - **ต้องพิสูจน์:** ไม่ polling/redownload ทุก 5 นาที; ไม่แสดงรูปเก่าหลังเปลี่ยน revision; no-photo ต่างจาก outage; ไม่เก็บ signed grant ใน browser persistent application cache; ทดสอบ add/replace/cancel/retry/concurrent edit และ deferred-caller regression ตาม contract ที่อนุมัติแล้ว
   - **ขอบเขต:** ถ้าพบ BE defect ให้ reopen BE ticket เจ้าของพฤติกรรม ไม่ซ่อน backend implementation ใหม่ในใบ FE และไม่ตัดสิน flow รอจำหน่าย

## ลำดับและ Frontier

เริ่ม 01 → 02 → 03 และ 04 (สองใบนี้ไม่บล็อกกัน) → 05 → 06 → 07

แม้ 03/04 ทำได้แยกกันหลัง 02 ผู้ใช้สามารถทำทีละใบตามเลขได้ ไม่เป็นคำสั่งให้ใช้ subagent หรือทำงานหลายคนพร้อมกัน ทุกงาน FE มี 05 เป็น phase barrier จึงเริ่มไม่ได้เพียงเพราะ API บางส่วนพร้อม

## การเผยแพร่และเริ่มงานตาม to-tickets

ผู้ใช้ยืนยันขนาดงานและ dependency ของทั้ง 7 ใบแล้ว จึงเผยแพร่ `issues/` พร้อม acceptance criteria สถานะทุกใบเป็น `ready-for-agent` ไม่ใช่ `done` และไม่ใช่อนุญาตให้ข้าม blocker

Frontier ปัจจุบันคือ 02 หลัง 01 ผ่าน G1 แล้ว; เมื่อ 02 เสร็จเริ่ม 03 หรือ 04; เมื่อสองใบนั้นเสร็จและ G1–G4 มีหลักฐาน/มติที่จำเป็นครบจึงปิด 05 และเริ่ม FE 06 ได้ ถ้า external gate ยังไม่ผ่านต้องแสดงงานค้างตรง ๆ ไม่อ้างว่า label พร้อมทำหมายถึงพร้อม release

การยืนยันนี้อนุมัติการแตกและเผยแพร่งาน ไม่ใช่คำสั่งให้เริ่มแก้โค้ดในรอบนี้ และไม่ได้เปลี่ยนมติเรื่องรอจำหน่ายหรือข้อจำกัด provider ที่อยู่ใน spec งานแต่ละใบทำพร้อม test ของตัวเอง และใช้ context ใหม่เมื่อเริ่ม implementation ใบถัดไปตาม workflow โครงการ
