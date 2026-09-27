# 09 — BE: Production seed และ bootstrap ADMIN สองคนแรก

**What to build:** Production มี ADMIN ตัวจริงสองบัญชีที่ยืนยันอีเมลและตั้ง 2FA แล้ว โดยไม่มีข้อมูลทดลองหรือรหัสผ่านฝังในระบบ

**Blocked by:** 03 — บังคับ Enrollment ตาม Role

**Owner / change boundary:** Backend deployment/bootstrap และ production data preparation

**Status:** done (2026-09-26)

**Delivery order:** ทำสคริปต์และทดสอบ idempotency ก่อน; ตรวจความพร้อมของบัญชีจริงก่อน handover ใน ticket 14

## เกณฑ์ส่งมอบ

- [x] แยก reference data ที่ Production ต้องใช้จาก mock/demo seed และไม่รัน mock seed ทั้งชุดบน Production
- [x] Bootstrap สร้างบัญชี ADMIN ตัวจริงสองคนด้วยรหัสผ่านเริ่มต้นที่สุ่มต่างกันและส่งส่วนตัว ไม่เก็บในโค้ดหรือ Log
- [x] รัน Bootstrap ซ้ำไม่สร้างบัญชีซ้ำ ไม่เปลี่ยนรหัสผ่านเดิม และไม่ทำให้บัญชีที่ตั้ง 2FA แล้วกลับสถานะเริ่มต้น
- [x] เจ้าของแต่ละบัญชียืนยันอีเมลและ enroll TOTP ด้วยตนเอง; ไม่บังคับเปลี่ยนรหัสผ่านเริ่มต้น
- [x] Handover check ปฏิเสธการส่งมอบจนทั้งสองบัญชี active, email-verified และ enroll แล้ว
- [x] ทดสอบ idempotency และกรณีบัญชีหนึ่งยังไม่พร้อม
