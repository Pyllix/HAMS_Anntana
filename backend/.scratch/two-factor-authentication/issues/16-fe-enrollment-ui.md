# 16 — FE: หน้าตั้งค่า TOTP และเก็บ Recovery Codes

**What to build:** ผู้ใช้ Role ที่บังคับตั้งค่า Authenticator ด้วยตนเองตั้งแต่เข้าระบบครั้งแรก แล้วเก็บรหัสกู้ก่อนใช้งานส่วนอื่น

**Blocked by:** 03 — BE: บังคับ Enrollment 2FA ตาม Role; 12 — FE: API client กลาง, Same-origin proxy และคืนสถานะ Login

**Owner / change boundary:** Frontend enrollment screens และ routing ระหว่าง setup; ไม่แก้หน้าล็อกอินยืนยัน 2FA ของ ticket 17

**Status:** ready-for-agent

- [ ] เมื่อ Server ระบุว่ายังไม่ enroll ให้เข้าได้เฉพาะ flow ตั้งค่า 2FA ไม่หลุดไปหน้าธุรกิจผ่านการพิมพ์ URL
- [ ] แสดง QR และ Secret สำรองแก่เจ้าของบัญชีเท่านั้น พร้อมช่องกรอก TOTP 6 หลักเพื่อยืนยัน
- [ ] หลังยืนยัน แสดง Recovery Codes 10 รหัสเพียงช่วงเดียว และให้ผู้ใช้ยืนยันว่าเก็บแล้วก่อนเข้าแอป
- [ ] Reload หรือกลับหน้าหลังจบ flow ไม่เปิดเผย Secret/Recovery Codes อีก
- [ ] มีข้อความผิดพลาดที่เข้าใจได้เมื่อ TOTP ไม่ถูกต้อง/หมดเวลา และทดสอบด้วย Browser flow
