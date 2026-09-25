# 23 — BE: เลิกส่ง Session Token ให้ Browser

**What to build:** หลัง Frontend ย้ายใช้ Cookie ครบแล้ว ระบบเว็บไม่รับ Session Token จากผล Login หรือพึ่ง Bearer token แบบเดิมอีก

**Blocked by:** 22 — FE: นำ token storage/Bearer ออกจากเว็บทั้งหมด

**Owner / change boundary:** Backend final auth cutover และ security regression; ไม่แก้ Frontend

**Status:** ready-for-agent

- [ ] Sign-in JSON และ Session endpoint ไม่ส่ง Session Token หรือ credential ที่ JavaScript นำไปเก็บ/เล่นซ้ำได้
- [ ] Web API ใช้ Cookie Session ที่เพิกถอนได้; ไม่มี fallback ฝั่ง Browser ที่ข้าม 2FA gate ผ่าน legacy bearer
- [ ] ถ้ามี non-browser API client ที่ได้รับอนุญาตจริง ให้แยกนโยบายของมันชัดเจน; ไม่คงช่อง Bearer ที่ Browser ใช้ได้โดยไม่ตั้งใจ
- [ ] ทดสอบว่า Frontend ใหม่ Login, reload, Sign-out และเรียก Business API ได้โดยไม่มี token ใน response/localStorage
- [ ] ทดสอบว่าทางเก่าที่อาศัย token ไม่กลายเป็นช่องข้าม Enrollment หรือ Role gate
