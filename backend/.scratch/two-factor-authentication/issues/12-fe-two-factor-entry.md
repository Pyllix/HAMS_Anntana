# 12 — FE: Enrollment และ Login ด้วย 2FA

**What to build:** ผู้ใช้ตั้ง Authenticator ด้วยตนเอง จากนั้น Login ด้วย TOTP หรือ Recovery Code และเลือก Trusted Browser ได้ตามสิทธิ์

**Blocked by:** 03 — บังคับ Enrollment; 04 — Recovery Code และ lockout; 05 — Trusted Browser; 10 — Cookie client กลาง

**Owner / change boundary:** Frontend enrollment, login challenge, routing และ Trusted Browser choice; ไม่แก้ transport กลาง

**Status:** done

**Delivery order:** ทำ enrollment และการยืนยันเก็บ Recovery Codes ก่อน จากนั้นต่อ login challenge และ Trusted Browser ใน flow เดียว

## Enrollment

- [x] เมื่อ Server ระบุว่ายังไม่ enroll ให้เข้าได้เฉพาะ flow ตั้งค่า 2FA ไม่หลุดไปหน้าธุรกิจผ่านการพิมพ์ URL
- [x] แสดง QR และ Secret สำรองแก่เจ้าของบัญชีเท่านั้น พร้อมช่องกรอก TOTP 6 หลักเพื่อยืนยัน
- [x] หลังยืนยัน แสดง Recovery Codes 10 รหัสเพียงช่วงเดียว และให้ผู้ใช้ยืนยันว่าเก็บแล้วก่อนเข้าแอป
- [x] Reload หรือกลับหน้าหลังจบ flow ไม่เปิดเผย Secret/Recovery Codes อีก
- [x] มีข้อความผิดพลาดที่เข้าใจได้เมื่อ TOTP ไม่ถูกต้อง/หมดเวลา และทดสอบด้วย Browser flow

## Login, Recovery Code และ Trusted Browser

- [x] Login ของสาม Role ที่บังคับแสดง TOTP challenge เมื่อ Browser ไม่ Trusted; Role อื่นไม่เห็นขั้นตอนนี้
- [x] มีทางเลือกใช้ Recovery Code เมื่อติดต่อ Authenticator ไม่ได้ พร้อมข้อความเมื่อรหัสใช้แล้วหรือถูกล็อกชั่วคราว
- [x] Checkbox จำ Browser ไม่ถูกเลือกไว้ล่วงหน้า และแสดงความหมายของ 14 วันอย่างไม่ชวนเข้าใจว่า Session จะอยู่ 14 วัน
- [x] บัญชี B บน Browser profile ที่เคย Trusted บัญชี A ต้องผ่าน 2FA ของ B; ไม่ใช้ trust ข้ามบัญชี
- [x] หน้า Login ไม่เก็บ TOTP, Recovery Code, Secret หรือ Session Token ใน localStorage
- [x] ทดสอบ Login ใหม่, Login ซ้ำใน Trusted Browser, หมด Trust และสลับบัญชี
## Verification

- Frontend `npm test` — passed (32 tests).
- Frontend `npm run lint` — passed.
- Frontend `npm run build` — passed.
- Edge browser flow against a local API stub — enrollment, recovery-code acknowledgement, direct-URL guard, TOTP and recovery login, trusted repeat login, expired trust, account switch, password-only role, reload secrecy, and pre-auth sign-out.
