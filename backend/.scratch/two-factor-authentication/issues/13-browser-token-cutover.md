# 13 — FE + BE: ปิด Browser token แบบเดิม

**What to build:** หน้าเว็บใช้ Cookie Session อย่างเดียว และ Backend ไม่ส่งหรือรับช่องทาง token เดิมที่ Browser นำไปข้าม 2FA gate ได้

**Blocked by:** 07 — หน้าตั้งค่าตนเอง; 08 — หน้าจอ ADMIN; 11 — ย้าย service; 12 — Enrollment และ Login

**Owner / change boundary:** Frontend รับผิดชอบการล้าง token storage/Bearer ทั้งเว็บ; Backend รับผิดชอบการปิด token response และ fallback; ต้องประสานสอง repository

**Status:** done (2026-09-27)

**Delivery order:** ปิดและทดสอบ Browser token ฝั่ง Frontend ก่อน แล้วจึงปิด legacy token ฝั่ง Backend; ปิด ticket เมื่อ regression ข้ามสองฝั่งผ่าน

## Frontend: ล้าง token และตรวจ Browser

- [x] ไม่มีการเก็บ Session Token ใน localStorage/sessionStorage หรือ state ที่ serialize ค้างบน Browser
- [x] ไม่มีบริการเว็บสร้าง Authorization Bearer จาก token เดิม และไม่มี direct Render URL ที่ข้าม API base path กลาง
- [x] Login, reload, เปลี่ยนหน้า, Sign-out และงานหลักทุกกลุ่มทำงานด้วย Cookie Session
- [x] ตรวจให้ token ที่เคยค้างใน Browser เก่าไม่ถูกนำกลับมาใช้อีก และล้างได้โดยไม่ลบ draft ของบัญชีอื่นโดยพลการ
- [x] ทดสอบ Browser integration กับ Cookie, CSRF และการไม่มี token ใน network response/Browser storage

## Backend: ปิด response และ fallback เดิม

- [x] Sign-in JSON และ Session endpoint ไม่ส่ง Session Token หรือ credential ที่ JavaScript นำไปเก็บ/เล่นซ้ำได้
- [x] Web API ใช้ Cookie Session ที่เพิกถอนได้; ไม่มี fallback ฝั่ง Browser ที่ข้าม 2FA gate ผ่าน legacy bearer
- [x] ถ้ามี non-browser API client ที่ได้รับอนุญาตจริง ให้แยกนโยบายของมันชัดเจน; ไม่คงช่อง Bearer ที่ Browser ใช้ได้โดยไม่ตั้งใจ
- [x] ทดสอบว่า Frontend ใหม่ Login, reload, Sign-out และเรียก Business API ได้โดยไม่มี token ใน response/localStorage
- [x] ทดสอบว่าทางเก่าที่อาศัย token ไม่กลายเป็นช่องข้าม Enrollment หรือ Role gate

**Verification:** Backend build passes; the full unit suite passes (48 suites / 399 tests); real HTTP auth integration passes (32 tests) against a fresh database with all 20 migrations applied. Frontend tests pass (38), lint and build pass. An actual Chromium smoke verifies legacy `token`/`userId` cleanup while preserving drafts, Cookie-only sign-in, no token field in the login result, HttpOnly cookies, session restore after reload, an authenticated `/users/:id` request, rejection of sign-out without CSRF, and successful revoking sign-out. Test databases were disposable; configured `hams_db` was not migrated or modified.
