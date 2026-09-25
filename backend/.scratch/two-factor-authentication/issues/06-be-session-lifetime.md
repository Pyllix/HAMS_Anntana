# 06 — BE: Session หมดอายุตามเวลาจริงและกิจกรรมผู้ใช้

**What to build:** Session อยู่ได้สูงสุด 12 ชั่วโมงและหมดเมื่อผู้ใช้ไม่ทำกิจกรรมจริง 60 นาที โดยคำขออัตโนมัติไม่สามารถต่อเวลาให้เครื่องที่เปิดค้าง

**Blocked by:** 02 — BE: Web Session ผ่าน Cookie และป้องกัน CSRF

**Owner / change boundary:** Backend session lifetime/activity API; Frontend warning อยู่ใน ticket 19

**Status:** ready-for-agent

- [ ] ฝั่ง Server บังคับ absolute expiry 12 ชั่วโมงนับจาก Sign-in แม้ผู้ใช้ยังใช้งาน
- [ ] ฝั่ง Server บังคับ idle expiry 60 นาทีตามกิจกรรมที่ผู้ใช้เริ่มเอง; background polling หรือเปิดหน้าเฉย ๆ ไม่ต่อเวลา
- [ ] การกดใช้งานต่อด้วย Session ที่ยังไม่หมดอายุเลื่อนเฉพาะ idle deadline ไม่เลื่อน absolute deadline
- [ ] Session endpoint ให้ข้อมูลเวลาที่ Frontend ใช้เตือนได้โดยไม่เผย credential
- [ ] ปิดแท็บหรือ Browser ไม่ Sign-out; Sign-out เพิกถอนทันที; หลายเครื่องคง Session แยกกัน
- [ ] ทดสอบขอบเวลา 55/60 นาที, 12 ชั่วโมง, polling และการใช้งานต่อ
