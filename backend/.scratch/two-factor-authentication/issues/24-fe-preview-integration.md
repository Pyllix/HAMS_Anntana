# 24 — FE: ทดสอบ Preview และส่งมอบเส้นทาง 2FA ครบวงจร

**What to build:** ทีมตรวจยืนยันบน Preview ว่า Backend–Frontend ที่ย้ายแล้วทำงานร่วมกันจริง ก่อนเปิดใช้ Production ตั้งแต่วันส่งมอบ

**Blocked by:** 11 — BE: Production seed และ bootstrap ADMIN สองคนแรก; 23 — BE: เลิกส่ง Session Token ให้ Browser; 19 — FE: ปกป้องฟอร์มค้างเมื่อ Session หมดหรือสลับบัญชี; 21 — FE: หน้าจัดการบัญชีและการกู้ 2FA โดย ADMIN; 22 — FE: นำ token storage/Bearer ออกจากเว็บทั้งหมด

**Owner / change boundary:** Frontend-led integration/preview verification ร่วมกับ Backend owner เพื่อตรวจ API และ deployment; ไม่รวมการเปิด Production จริงโดยอัตโนมัติ

**Status:** ready-for-agent

- [ ] Preview บน Vercel–Render ใช้ same-origin API proxy และ rewrite ก่อน SPA fallback; personalized response ไม่ถูก cache
- [ ] ตรวจ Set-Cookie, Secure/HttpOnly/SameSite, Sign-in, Sign-out, CSRF และ Browser ที่บล็อก third-party Cookies
- [ ] เดิน Flow ทุก Role รวม Enrollment, TOTP, Recovery Code, Trusted Browser, สลับบัญชี และ Role change
- [ ] ตรวจ timeout 60 นาที/12 ชั่วโมง, warning, draft ของบัญชีเดิม, password/2FA reset และการเพิกถอนทุกเครื่อง
- [ ] ตรวจ Handover check ของ ADMIN สองคนและไม่มี public self-sign-up หรือ token fallback เปิดค้าง
- [ ] บันทึกผลทดสอบและข้อบกพร่องที่ยังเหลือก่อนอนุมัติเปิดใช้ Production
