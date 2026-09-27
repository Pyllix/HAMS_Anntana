# 04 — BE: ใช้ Recovery Code และจำกัดการเดา 2FA

**What to build:** ผู้ใช้ที่ไม่มี Authenticator ชั่วคราวใช้ Recovery Code ได้หนึ่งครั้งต่อรหัส ขณะที่การเดารหัสผิดซ้ำถูกระงับชั่วคราวโดยไม่ล็อกบัญชีถาวร

**Blocked by:** 03 — BE: บังคับ Enrollment 2FA ตาม Role

**Owner / change boundary:** Backend 2FA verification และ attempt state; ไม่แก้ Enrollment UI

**Status:** ✅ done

- [x] Recovery Code ที่ถูกต้องใช้แทน TOTP ได้ครั้งเดียวและถูก consume แบบไม่เกิด race condition
- [x] ไม่คืน Recovery Code เดิมหรือข้อมูลที่ถอดกลับได้จากฐานข้อมูลใน API ใด
- [x] ความผิดพลาดของ TOTP และ Recovery Code นับรวมกัน; ผิดครบ 5 ครั้งระงับการตรวจ 2FA ของบัญชี 10 นาที
- [x] การตรวจสำเร็จล้างตัวนับ และเมื่อครบเวลาระงับผู้ใช้ลองใหม่ได้โดยไม่ต้องให้ ADMIN ปลดล็อก
- [x] บันทึกเหตุการณ์ lockout โดยไม่บันทึกค่ารหัส และทดสอบการใช้รหัสซ้ำ/พร้อมกัน/หมดอายุสถานะล็อก

**Implementation:**
- Recovery-code consumption and TOTP verification run in a transaction with a row lock, so concurrent requests cannot consume one code twice.
- TOTP and recovery-code failures share one five-attempt, ten-minute lockout counter. Successful verification clears it; expired locks are cleared when checked.
- Logs identify the account without recording submitted codes.

**Verification:** The database-free 2FA unit suite covers concurrent attempts and combined lockout. The database-backed 2FA and trusted-browser service suites passed 33 tests. HTTP integration verifies a recovery code succeeds once and reuse is rejected; the complete 03–05 auth integration suite passed 24 tests with one unrelated ticket 13 token-cutover case intentionally skipped. Tests used a fresh disposable database synchronized from the current Prisma schema. Historical migration drift is documented in docs/2FA_TRUSTED_BROWSER.md.
