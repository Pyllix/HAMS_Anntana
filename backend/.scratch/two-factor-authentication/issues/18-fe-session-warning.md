# 18 — FE: เตือนก่อน Session หมดและให้ใช้งานต่อ

**What to build:** ผู้ใช้ที่กำลังอ่านหรือทำงานเห็นคำเตือนห้านาทีก่อนครบเวลาไม่มีกิจกรรมและกดอยู่ต่อได้ ก่อน Server ตัด Session

**Blocked by:** 06 — BE: Session หมดอายุตามเวลาจริงและกิจกรรมผู้ใช้; 12 — FE: API client กลาง, Same-origin proxy และคืนสถานะ Login

**Owner / change boundary:** Frontend session activity/warning UI กลาง; ไม่แก้ฟอร์มค้างของ ticket 19

**Status:** ready-for-agent

- [ ] การคลิก พิมพ์ เลื่อนหน้า และเปิดข้อมูลที่ผู้ใช้สั่งเองถูกส่งเป็นกิจกรรมตามสัญญา
- [ ] Background polling และการเปิดหน้าเฉย ๆ ไม่ทำให้ UI หรือ Server ต่อเวลา
- [ ] แจ้งเตือนก่อน idle expiry 5 นาที และปุ่มใช้งานต่อยืดเฉพาะ idle deadline
- [ ] ที่ 12 ชั่วโมง absolute expiry ต้อง Login ใหม่แม้มีการใช้งานต่อ
- [ ] ทดสอบเวลาใกล้หมด, การกดต่อเวลา, การไม่ตอบสนอง และการข้ามแท็บ
