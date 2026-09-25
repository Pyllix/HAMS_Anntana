# 14 — FE: ย้ายคำของานซ่อมและอะไหล่ไป Cookie client

**What to build:** งานซ่อมและอะไหล่ยังดำเนินได้ตามเดิมโดยไม่พึ่ง token ใน Browser

**Blocked by:** 12 — FE: API client กลาง, Same-origin proxy และคืนสถานะ Login

**Owner / change boundary:** Frontend service กลุ่มแจ้งซ่อม, ประเมิน/ติดตามงาน, อะไหล่ และใบสั่งที่เกี่ยวข้อง; ไม่แก้ shared client หรือกลุ่มครุภัณฑ์

**Status:** ready-for-agent

- [ ] ทุกคำขอในกลุ่มนี้ใช้ shared Cookie client และ API base path กลาง
- [ ] ไม่มีการอ่าน token จาก localStorage หรือสร้าง Authorization Bearer ในพื้นที่รับผิดชอบ
- [ ] ตรวจอย่างน้อยการอ่านคิวงาน, ส่งคำขอ, อนุมัติ/อัปเดตงาน และเบิก/สั่งอะไหล่
- [ ] คำขอที่ Session หมดอายุส่งสถานะให้ flow กลางและไม่สร้างข้อมูลซ้ำเมื่อผู้ใช้ Login ใหม่
- [ ] เพิ่ม regression tests ตามหน้าที่หลักของกลุ่มนี้
