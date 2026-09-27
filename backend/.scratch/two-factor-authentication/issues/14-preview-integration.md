# 14 — FE + BE: ตรวจ Preview และเตรียมส่งมอบ

**What to build:** ทีมตรวจระบบ 2FA และ Cookie Session บน Vercel–Render Preview ครบวงจรก่อนเปิดใช้ Production

**Blocked by:** 06 — Session และ draft; 08 — ADMIN security; 09 — Bootstrap; 12 — 2FA entry; 13 — Browser token cutover

**Owner / change boundary:** Frontend นำการตรวจ Preview ร่วมกับ Backend owner เพื่อตรวจ API, database และ deployment

**Status:** ready-for-agent

**Delivery order:** ทำหลัง ticket ที่เป็น release gate เสร็จทั้งหมด; บันทึกผลและข้อบกพร่องก่อนอนุมัติ Production

## เกณฑ์ส่งมอบ

- [ ] Preview บน Vercel–Render ใช้ same-origin API proxy และ rewrite ก่อน SPA fallback; personalized response ไม่ถูก cache
- [ ] ตรวจ Set-Cookie, Secure/HttpOnly/SameSite, Sign-in, Sign-out, CSRF และ Browser ที่บล็อก third-party Cookies
- [ ] เดิน Flow ทุก Role รวม Enrollment, TOTP, Recovery Code, Trusted Browser, สลับบัญชี และ Role change
- [ ] ตรวจ timeout 60 นาที/12 ชั่วโมง, warning, draft ของบัญชีเดิม, password/2FA reset และการเพิกถอนทุกเครื่อง
- [ ] ตรวจ Handover check ของ ADMIN สองคนและไม่มี public self-sign-up หรือ token fallback เปิดค้าง
- [ ] บันทึกผลทดสอบและข้อบกพร่องที่ยังเหลือก่อนอนุมัติเปิดใช้ Production
