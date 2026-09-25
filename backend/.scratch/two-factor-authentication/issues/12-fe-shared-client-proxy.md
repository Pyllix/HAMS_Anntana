# 12 — FE: API client กลาง, Same-origin proxy และคืนสถานะ Login

**What to build:** หน้าเว็บเริ่มใช้ Cookie Session ผ่าน API origin เดียวกับเว็บและคืนสถานะผู้ใช้จาก Server หลังเปิดหน้าใหม่ โดยยังไม่ทำให้ service เก่าที่รอย้ายหยุดทำงาน

**Blocked by:** 01 — BE: ข้อตกลง API ยืนยันตัวตนและจุดทดสอบจริง; 02 — BE: Web Session ผ่าน Cookie และป้องกัน CSRF

**Owner / change boundary:** Frontend shared transport, routing/auth state และ Vercel rewrite; ticket อื่นไม่แก้พื้นที่ส่วนกลางนี้พร้อมกัน

**Status:** ready-for-agent

- [ ] กำหนด API base path จุดเดียวและ Vercel rewrite ไป Backend ก่อน SPA fallback
- [ ] เพิ่ม shared client ที่ส่ง Cookie/CSRF ตามสัญญาและไม่พึ่งการอ่าน token สำหรับคำขอใหม่
- [ ] Reload หน้าเว็บแล้วตรวจ Session ฝั่ง Server เพื่อคืน user/Role โดยไม่เชื่อค่าที่ค้างใน localStorage
- [ ] Sign-out เรียก Server เพื่อเพิกถอน Session ก่อนล้าง state หน้าเว็บ
- [ ] ช่วง expand service เดิมยังทำงานได้จน ticket 13–15 ย้ายเสร็จ
- [ ] ทดสอบ proxy route, reload, Sign-out และกรณี Session หมดอายุ
