# 15 — FE: ย้ายคำขอผู้ใช้/ข้อมูลอ้างอิงและ service ที่เหลือ

**What to build:** ส่วนจัดการผู้ใช้และข้อมูลประกอบระบบใช้ Cookie client ครบ โดยไม่มี service เก่าที่แอบอ่าน token ค้างอยู่

**Blocked by:** 12 — FE: API client กลาง, Same-origin proxy และคืนสถานะ Login

**Owner / change boundary:** Frontend user/reference/notification และ service ที่เหลือนอกขอบ ticket 13–14; ไม่แก้ auth screens, shared client หรือหน้าจอ ADMIN ของ ticket 21

**Status:** ready-for-agent

- [ ] ย้าย user-management service, ข้อมูลอ้างอิง และ service ที่เหลือไป shared Cookie client
- [ ] ตรวจค้นหา/สร้าง/แก้ไขผู้ใช้และการอ่านข้อมูลประกอบโดยไม่ใช้ Authorization Bearer
- [ ] ระบุบัญชีรายชื่อ call site ทั้งหมดในพื้นที่นี้และยืนยันว่าไม่มี localStorage token lookup เหลือ
- [ ] รักษารูปแบบข้อผิดพลาดและการคืนสถานะ Session ให้หน้าจอที่ใช้ service เหล่านี้
- [ ] ทดสอบ regression ของงาน ADMIN ปกติและข้อมูลอ้างอิง โดยไม่แตะขั้นตอน Step-up UI
