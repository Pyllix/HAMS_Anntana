# 01 — BE: ข้อตกลง API ยืนยันตัวตนและจุดทดสอบจริง

**What to build:** ให้ทีม Backend และ Frontend มีสัญญาเดียวกันสำหรับสถานะ Login, Enrollment, TOTP, Recovery Code, Trusted Browser, Session และข้อผิดพลาด ผู้ใช้จึงได้รับหน้าจอที่ตรงกับสิทธิ์จริงทุกขั้นโดยไม่เกิดช่องข้าม 2FA

**Blocked by:** None — can start immediately.

**Owner / change boundary:** Backend auth contract และชุดทดสอบ HTTP; Frontend ใช้สัญญานี้แต่ไม่แก้โค้ด Backend ใน ticket นี้

**Status:** done

- [x] ระบุผลลัพธ์และข้อผิดพลาดที่สังเกตได้ของ Login, Enrollment, Verification, Session, Sign-out, Step-up และการเพิกถอน โดยไม่ส่ง Session Token ให้ Browser ในรูปแบบสุดท้าย → `docs/auth-api-contract.md` §4
- [x] ระบุว่า pre-auth/enrollment context ทำอะไรได้และทำอะไรไม่ได้ รวมถึงเมื่อ Role เปลี่ยนหรือ Session หมดอายุ → `docs/auth-api-contract.md` §3, §5, §9
- [x] ระบุวิธีส่ง Cookie, CSRF proof, Trusted Browser choice และ Session activity ระหว่าง Backend/Frontend ก่อนเริ่มงานหน้าจอ → `docs/auth-api-contract.md` §2, §8
- [x] ระบุรหัสข้อผิดพลาดที่ Frontend แยกได้ เช่น ต้องตั้ง 2FA, ต้องกรอก TOTP, Recovery Code ใช้แล้ว, ถูกล็อกชั่วคราว, Session หมดอายุ และต้อง Step-up → `docs/auth-api-contract.md` §6
- [x] เพิ่มชุดทดสอบ HTTP ที่ใช้ auth integration จริงและฐานข้อมูลทดสอบ แทนการจำลอง Guard จนข้ามพฤติกรรม 2FA → `test/auth-contract.auth-integration.e2e-spec.ts` + `test/jest-auth-integration.json`
- [x] ตรวจให้สัญญาครอบคลุมทั้ง HAMS API และเส้นทาง BetterAuth ที่เปิดตรง → `docs/auth-api-contract.md` §10, §11; `disabledPaths` ใน `src/auth/auth.ts`
