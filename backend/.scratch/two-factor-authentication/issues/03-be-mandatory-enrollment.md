# 03 — BE: บังคับ Enrollment 2FA ตาม Role

**What to build:** ผู้ใช้ในสาม Role ที่กำหนดเข้า Business API ได้ต่อเมื่อตั้ง Authenticator และเก็บ Recovery Codes ของตนเองเสร็จ ส่วน Role อื่นยังล็อกอินตามปกติ

**Blocked by:** 02 — BE: Web Session ผ่าน Cookie และป้องกัน CSRF

**Owner / change boundary:** Backend 2FA enrollment และ auth gate; ไม่ทำหน้าจอ Frontend หรือฟังก์ชันใช้ Recovery Code ตอนล็อกอิน

**Status:** ready-for-agent

- [ ] บังคับเฉพาะ ADMIN, PARCEL_STAFF และ ASSET_CENTER_STAFF; Role อื่นไม่ถูกส่งเข้า Enrollment
- [ ] หลังตรวจรหัสผ่าน บัญชีที่ยังไม่ตั้ง 2FA ได้เพียงสิทธิ์สำหรับ Enrollment/ยืนยันอีเมล ไม่ได้ Session ปกติหรือ Business API
- [ ] เจ้าของบัญชีเห็น QR/Secret เพื่อผูก Authenticator เอง; ADMIN ผู้สร้างบัญชีไม่เห็น Secret
- [ ] TOTP เป็น 6 หลัก รอบ 30 วินาที รับ previous/current/next time step และ Secret ถูกเข้ารหัสเมื่อเก็บ
- [ ] หลังพิสูจน์ TOTP ให้สร้าง Recovery Codes 10 รหัส แสดงครั้งเดียว เก็บเป็นแฮช และต้องยืนยันว่าเก็บแล้วก่อนจบ Enrollment
- [ ] ทดสอบว่าทั้ง HAMS API และ BetterAuth route ที่เปิดตรงไม่สามารถข้าม gate; หลังจบ Enrollment จึงเริ่ม Session ปกติได้
