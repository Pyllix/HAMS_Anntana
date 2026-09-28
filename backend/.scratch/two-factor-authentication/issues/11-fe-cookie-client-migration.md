# 11 — FE: ย้าย service ทั้งหมดไป Cookie client

**What to build:** บริการครุภัณฑ์ ยืม-คืน ซ่อม อะไหล่ ผู้ใช้ ข้อมูลอ้างอิง และส่วนที่เหลือ ใช้ Cookie client โดยไม่อ่านหรือส่ง Browser token

**Blocked by:** 10 — Cookie client กลางและ proxy

**Owner / change boundary:** Frontend service call sites ทั้งสามกลุ่ม; ไม่แก้ shared client, auth screens หรือหน้าจอ ADMIN

**Status:** complete

**Delivery order:** ย้ายและทดสอบทีละกลุ่มภายใน ticket เดียว; แจ้งรายการ call site ที่เสร็จให้ ticket 08 ใช้ทำหน้าจอ ADMIN

## ครุภัณฑ์ สถานะ โอน/จำหน่าย และยืม-คืน

- [x] ทุกคำขอในกลุ่มนี้ใช้ shared Cookie client และ API base path กลาง
- [x] ไม่มีการอ่าน token จาก localStorage หรือสร้าง Authorization Bearer ในพื้นที่รับผิดชอบ
- [x] ตรวจรายการ อ่านรายละเอียด สร้าง/แก้ไข และธุรกรรมยืม-คืนกับ Session ปกติ
- [x] เมื่อ Session หมดอายุ คำขอที่แก้ข้อมูลไม่สำเร็จเงียบ ๆ และส่งสถานะให้ flow กลางจัดการ
- [x] เพิ่ม regression tests ที่ขอบ service/หน้าจอหลักของกลุ่มนี้

## ซ่อม อะไหล่ และใบสั่ง

- [x] ทุกคำขอในกลุ่มนี้ใช้ shared Cookie client และ API base path กลาง
- [x] ไม่มีการอ่าน token จาก localStorage หรือสร้าง Authorization Bearer ในพื้นที่รับผิดชอบ
- [x] ตรวจอย่างน้อยการอ่านคิวงาน, ส่งคำขอ, อนุมัติ/อัปเดตงาน และเบิก/สั่งอะไหล่
- [x] คำขอที่ Session หมดอายุส่งสถานะให้ flow กลางและไม่สร้างข้อมูลซ้ำเมื่อผู้ใช้ Login ใหม่
- [x] เพิ่ม regression tests ตามหน้าที่หลักของกลุ่มนี้

## ผู้ใช้ ข้อมูลอ้างอิง การแจ้งเตือน และบริการที่เหลือ

- [x] ย้าย user-management service, ข้อมูลอ้างอิง และ service ที่เหลือไป shared Cookie client
- [x] ตรวจค้นหา/สร้าง/แก้ไขผู้ใช้และการอ่านข้อมูลประกอบโดยไม่ใช้ Authorization Bearer
- [x] ระบุบัญชีรายชื่อ call site ทั้งหมดในพื้นที่นี้และยืนยันว่าไม่มี localStorage token lookup เหลือ
- [x] รักษารูปแบบข้อผิดพลาดและการคืนสถานะ Session ให้หน้าจอที่ใช้ service เหล่านี้
- [x] ทดสอบ regression ของงาน ADMIN ปกติและข้อมูลอ้างอิง โดยไม่แตะขั้นตอน Step-up UI
## Verification

- Frontend tests: 25/25 passed, including cookie client, CSRF, borrow return, repair submission, spare withdrawal approval, user update, department detail/update/delete routes, and expired-session fallback behavior.
- `npm run lint`: passed.
- `npm run build`: passed. Vite reports the existing main bundle is above 500 kB.
- Service scan: no legacy localStorage token lookup, Bearer header, hardcoded Render API URL, or direct Axios request remains outside the shared client.