# 13 — FE: ย้ายคำขอครุภัณฑ์และยืม-คืนไป Cookie client

**What to build:** งานครุภัณฑ์และการยืม-คืนยังทำได้เหมือนเดิมโดยไม่อ่าน Browser token หรือส่ง Authorization Bearer

**Blocked by:** 12 — FE: API client กลาง, Same-origin proxy และคืนสถานะ Login

**Owner / change boundary:** Frontend service กลุ่มครุภัณฑ์, สถานะทรัพย์สิน, โอน/จำหน่าย และยืม-คืน; ไม่แก้ shared client หรือ service กลุ่มอื่น

**Status:** ready-for-agent

- [ ] ทุกคำขอในกลุ่มนี้ใช้ shared Cookie client และ API base path กลาง
- [ ] ไม่มีการอ่าน token จาก localStorage หรือสร้าง Authorization Bearer ในพื้นที่รับผิดชอบ
- [ ] ตรวจรายการ อ่านรายละเอียด สร้าง/แก้ไข และธุรกรรมยืม-คืนกับ Session ปกติ
- [ ] เมื่อ Session หมดอายุ คำขอที่แก้ข้อมูลไม่สำเร็จเงียบ ๆ และส่งสถานะให้ flow กลางจัดการ
- [ ] เพิ่ม regression tests ที่ขอบ service/หน้าจอหลักของกลุ่มนี้
