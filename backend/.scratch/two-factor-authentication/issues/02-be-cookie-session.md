# 02 — BE: Web Session ผ่าน Cookie และป้องกัน CSRF

**Status:** ✅ Done (2026-09-25)

**What to build:** ผู้ใช้เว็บได้รับ Session ฝั่ง Server ผ่าน Cookie ที่ Browser ส่งเอง โดยคำขอข้ามเว็บที่ไม่ได้รับอนุญาตไม่สามารถแก้ข้อมูลแทนผู้ใช้ได้ ช่วงย้ายระบบยังไม่ทำให้ Frontend เก่าหยุดทำงานก่อน ticket ปิดของเดิม

**Blocked by:** 01 — BE: ข้อตกลง API ยืนยันตัวตนและจุดทดสอบจริง

**Owner / change boundary:** Backend auth/session transport, CORS และ response policy; ไม่แตะ UI หรือ service client ของ Frontend

**Status:** ready-for-agent

- [ ] Sign-in, Session lookup และ Sign-out รองรับ Cookie แบบ Secure, HttpOnly, host-only และ SameSite ที่กำหนดชัดตามสภาพแวดล้อม
- [ ] API ที่แก้ข้อมูลตรวจ CSRF/Origin ตามสัญญา และ CORS ยอมรับเฉพาะ Frontend Origin ที่ระบุชัด
- [ ] Response ที่มีข้อมูล Session หรือข้อมูลเฉพาะบัญชีใช้ no-store; Sign-out เพิกถอน Session และล้าง Cookie
- [ ] ช่วง expand ยังให้ Client เก่าทำงานได้ตามแผนย้าย แต่ไม่ถือว่าพร้อม Production จน ticket 23 ปิด token แบบเดิม
- [ ] ทดสอบ Cookie attributes, คำขอข้าม Origin, CSRF, Sign-out และ Session lookup ผ่าน HTTP จริง
