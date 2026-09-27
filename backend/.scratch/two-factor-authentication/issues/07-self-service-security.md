# 07 — BE + FE: ผู้ใช้จัดการความปลอดภัยบัญชีตนเอง

**What to build:** ผู้ใช้เปลี่ยน Authenticator, Recovery Codes และรหัสผ่านตนเองได้โดยพิสูจน์ตัวตนใหม่และเห็นผลการเพิกถอนสิทธิ์

**Blocked by:** 04 — Recovery Code และ lockout; 05 — Trusted Browser

**Owner / change boundary:** Backend รับผิดชอบ 2FA lifecycle, Step-up และการเพิกถอน Session; Frontend รับผิดชอบหน้าตั้งค่าของเจ้าของบัญชี

**Status:** backend and frontend implemented; targeted tests, the fully migrated backend suite, and browser flows pass.

**Delivery order:** Backend เริ่มได้ทันที; Frontend เริ่มหลัง ticket 10. ส่งมอบ Step-up ฝั่ง Backend ให้ ticket 08 ใช้ก่อนปิดงานทั้งใบได้

## Backend: 2FA และ Step-up

- [x] ไม่มี API ที่ปล่อยให้ Role ที่บังคับปิด 2FA และกลับเข้า Business API โดยไม่มี Enrollment
- [x] เปลี่ยน Authenticator ได้หลังยืนยันรหัสผ่านเดิมและ TOTP ปัจจุบัน; Secret ใหม่ไม่ถูกเปิดเผยแก่ ADMIN
- [x] สร้าง Recovery Codes ชุดใหม่ต้องยืนยัน TOTP ปัจจุบัน; ชุดเก่าใช้ไม่ได้และชุดใหม่แสดงครั้งเดียว/เก็บเป็นแฮช
- [x] Step-up ของ ADMIN ผูกกับบัญชีและ Session ปัจจุบัน มีอายุ 5 นาที ไม่ข้ามไปอีก Session
- [x] Step-up สิ้นสุดเมื่อ Sign-out, Session ถูกเพิกถอน หรือ ADMIN เปลี่ยนรหัสผ่าน/2FA
- [x] ทดสอบว่าการทำรายการเหล่านี้ยังขอ TOTP แม้ Browser ยัง Trusted

## Backend: เปลี่ยนรหัสผ่านตนเอง

- [x] Self-service password change ต้องตรวจรหัสผ่านเดิม คง Session ปัจจุบัน และเพิกถอน Session เครื่องอื่นกับ Trusted Browser ทุกเครื่อง
- [x] หลัง self-change Login ครั้งถัดไปของ Role ที่บังคับต้องพิสูจน์ 2FA ใหม่ก่อนเลือก Trust ได้อีกครั้ง
- [x] ทดสอบว่าคงเฉพาะ Session ปัจจุบัน เพิกถอน Session อื่นและ Trusted Browser และไม่บันทึกรหัสผ่านใน Audit Log

## Frontend: หน้าตั้งค่าตนเอง

- [x] เปลี่ยน Authenticator ด้วยรหัสผ่านเดิมและ TOTP ปัจจุบัน พร้อมยืนยันการผูกตัวใหม่ตามผล Server
- [x] สร้าง Recovery Codes ชุดใหม่หลัง TOTP และแสดงชุดใหม่ครั้งเดียว พร้อมแจ้งว่าชุดเก่าใช้ไม่ได้
- [x] เปลี่ยนรหัสผ่านตนเองโดยกรอกรหัสเดิม แล้วแสดงว่าคง Session ปัจจุบันไว้แต่เครื่องอื่นและ Trusted Browser ถูกเพิกถอน
- [x] ไม่บังคับให้เปลี่ยนรหัสผ่านเริ่มต้นตอน Login ครั้งแรก; ผู้ใช้เข้าหน้านี้เมื่อเลือกเปลี่ยนเอง
- [x] ไม่มีปุ่มหรือเส้นทางให้ Role ที่บังคับปิด 2FA
- [x] Trusted Browser ไม่ทำให้ข้าม TOTP สำหรับการเปลี่ยน 2FA/รหัสกู้
- [x] จัดการ Session/Step-up หมดอายุโดยไม่ค้างหน้าความปลอดภัยที่แสดงข้อมูลลับ

**Verification:** Backend security unit/controller tests pass (64 tests across the targeted suites), including keeping the active browser signed in with a rotated HttpOnly cookie and omitting the returned session token from JSON after password change. All 20 migrations applied successfully to an isolated verification database and the backend suite passed 47 suites / 393 tests there. Frontend tests, lint, build, and browser flows pass. The existing local `hams_db` has 32 tables but no `_prisma_migrations` table, so it was left untouched to avoid applying the full migration history over an existing schema.
