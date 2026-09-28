# 05 — BE: Trusted Browser 14 วันแบบแยกบัญชี

**What to build:** ผู้ใช้เลือกจำ Browser หลังผ่าน 2FA ได้ 14 วันโดยไม่ต้องกรอก TOTP ทุกครั้ง แต่บัญชีอื่นใน Browser profile เดียวกันไม่ได้รับสิทธิ์นี้

**Blocked by:** 03 — BE: บังคับ Enrollment 2FA ตาม Role

**Owner / change boundary:** Backend trusted-browser credential และ sign-in decision; ไม่แก้ Checkbox หรือหน้าล็อกอิน

**Status:** ✅ done

- [x] ออก Trust เฉพาะเมื่อผู้ใช้เลือกเองหลังยืนยัน TOTP หรือ Recovery Code; ค่าเริ่มต้นคือไม่เลือก
- [x] Trust หมดอายุแบบ absolute 14 วันจากเวลา grant และไม่เลื่อนอายุเมื่อ Login ซ้ำ
- [x] Credential เป็นค่าสุ่ม 256-bit เก็บในฐานข้อมูลเฉพาะ SHA-256 hash; ผูกกับบัญชีเดียวและส่งผ่าน HttpOnly cookie เท่านั้น
- [x] เมื่อบัญชี B ลงชื่อเข้าใน Browser profile ที่มี Trust ของบัญชี A ระบบเพิกถอน Trust ของ A และให้ B ผ่าน TOTP ก่อนเลือก Trust ของตน
- [x] Trust ไม่ข้ามรหัสผ่านหรือยืดอายุ Web Session; ทดสอบการใช้ซ้ำข้ามบัญชี การหมดอายุ และการเพิกถอน

**Implementation:**
- TrustedBrowserService grants an opaque browser cookie only after successful 2FA when trustBrowser is true; the default remains false.
- Only the SHA-256 hash and display metadata are stored. The user-agent fingerprint does not authorize trust.
- A credential is valid only for its owning account and until its absolute expiry. Signing in with another account revokes it.
- Trust skips TOTP only. The account password and normal BetterAuth session are still required.
- Authenticated management routes list and revoke a user's trusted browsers without returning cookie credentials.

**Scope:**
- Ticket 03 owns mandatory enrollment, the pre-auth gate, and denial of business API access before enrollment/TOTP; its guard and legacy-session regression tests pass.
- Ticket 12 owns the Frontend login challenge and checkbox UI.
- Ticket 13 removes the legacy Session Token from browser-facing responses after its Frontend token-removal step. Ticket 05 keeps the separate Trusted Browser credential out of JSON.

**Verification:** The database-free trusted-browser unit suite covers hashed storage, exact 14-day expiry, no sliding renewal, cross-account revocation, expiry, and non-disclosure. Database-backed 2FA and trusted-browser service suites passed 33 tests. HTTP integration covers opt-in trust, password-required sign-in, TOTP bypass for the owning account, and cross-account revocation. The full 03–05 auth integration suite passed 24 tests; one unrelated ticket 13 token-cutover case remains intentionally skipped. Verification used a fresh disposable database synchronized from the current Prisma schema. Historical migration drift is documented in docs/2FA_TRUSTED_BROWSER.md.
