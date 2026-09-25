# 11 — BE: Production seed และ bootstrap ADMIN สองคนแรก

**What to build:** ก่อนส่งมอบ HAMS มี ADMIN ตัวจริงสองบัญชีที่ยืนยันอีเมลและตั้ง 2FA แล้ว โดยไม่มีข้อมูลทดลองหรือรหัสผ่านฝังในระบบ Production

**Blocked by:** 03 — BE: บังคับ Enrollment 2FA ตาม Role

**Owner / change boundary:** Backend deployment/bootstrap และ production data preparation; ไม่แก้หน้าจอ Frontend

**Status:** ready-for-agent

- [ ] แยก reference data ที่ Production ต้องใช้จาก mock/demo seed และไม่รัน mock seed ทั้งชุดบน Production
- [ ] Bootstrap สร้างบัญชี ADMIN ตัวจริงสองคนด้วยรหัสผ่านเริ่มต้นที่สุ่มต่างกันและส่งส่วนตัว ไม่เก็บในโค้ดหรือ Log
- [ ] รัน Bootstrap ซ้ำไม่สร้างบัญชีซ้ำ ไม่เปลี่ยนรหัสผ่านเดิม และไม่ทำให้บัญชีที่ตั้ง 2FA แล้วกลับสถานะเริ่มต้น
- [ ] เจ้าของแต่ละบัญชียืนยันอีเมลและ enroll TOTP ด้วยตนเอง; ไม่บังคับเปลี่ยนรหัสผ่านเริ่มต้น
- [ ] Handover check ปฏิเสธการส่งมอบจนทั้งสองบัญชี active, email-verified และ enroll แล้ว
- [ ] ทดสอบ idempotency และกรณีบัญชีหนึ่งยังไม่พร้อม
