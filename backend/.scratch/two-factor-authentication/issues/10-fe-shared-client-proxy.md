# 10 — FE: Cookie client กลางและ Same-origin proxy

**What to build:** เว็บใช้ Cookie Session ผ่าน API origin เดียวกันและคืนสถานะผู้ใช้จาก Server หลังเปิดหน้าใหม่ โดยยังรองรับ service เก่าระหว่างย้าย

**Blocked by:** 01 — ข้อตกลง API; 02 — Cookie Session และ CSRF

**Owner / change boundary:** Frontend shared transport, routing/auth state และ Vercel rewrite; ticket อื่นไม่แก้พื้นที่ส่วนกลางพร้อมกัน

**Status:** done (2026-09-27)

**Verification:** Frontend tests 21/21, production build and lint passed (2026-09-27).

**Delivery order:** ส่งมอบ client และ proxy ให้ ticket 06, 07, 11 และ 12 ใช้ก่อนเริ่มงาน Frontend ของแต่ละใบ

## เกณฑ์ส่งมอบ

- [x] กำหนด API base path จุดเดียวและ Vercel rewrite ไป Backend ก่อน SPA fallback
- [x] เพิ่ม shared client ที่ส่ง Cookie/CSRF ตามสัญญาและไม่พึ่งการอ่าน token สำหรับคำขอใหม่
- [x] Reload หน้าเว็บแล้วตรวจ Session ฝั่ง Server เพื่อคืน user/Role โดยไม่เชื่อค่าที่ค้างใน localStorage
- [x] Sign-out เรียก Server เพื่อเพิกถอน Session ก่อนล้าง state หน้าเว็บ
- [x] ช่วง expand service เดิมยังทำงานได้จน ticket 11 ย้ายเสร็จ โดย service ที่สร้าง Axios instance แยกใช้ shared client สำหรับ Cookie, CSRF และ session-expiry
- [x] ทดสอบ proxy route, reload, Sign-out และกรณี Session หมดอายุ
