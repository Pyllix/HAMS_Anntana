# 17 — FE: ล็อกอินด้วย TOTP/Recovery Code และเลือก Trusted Browser

**What to build:** ผู้ใช้ที่ตั้ง 2FA แล้วผ่านขั้นตอนยืนยันที่ตรงสถานะ Browser และสามารถเลือกจำ Browser เพื่อลดการกรอกรหัสในกะถัดไป

**Blocked by:** 04 — BE: ใช้ Recovery Code และจำกัดการเดา 2FA; 05 — BE: Trusted Browser 14 วันแบบแยกบัญชี; 16 — FE: หน้าตั้งค่า TOTP และเก็บ Recovery Codes

**Owner / change boundary:** Frontend Login, 2FA challenge และ Trusted Browser choice; ไม่แก้ transport กลางหรือหน้า self-service settings

**Status:** ready-for-agent

- [ ] Login ของสาม Role ที่บังคับแสดง TOTP challenge เมื่อ Browser ไม่ Trusted; Role อื่นไม่เห็นขั้นตอนนี้
- [ ] มีทางเลือกใช้ Recovery Code เมื่อติดต่อ Authenticator ไม่ได้ พร้อมข้อความเมื่อรหัสใช้แล้วหรือถูกล็อกชั่วคราว
- [ ] Checkbox จำ Browser ไม่ถูกเลือกไว้ล่วงหน้า และแสดงความหมายของ 14 วันอย่างไม่ชวนเข้าใจว่า Session จะอยู่ 14 วัน
- [ ] บัญชี B บน Browser profile ที่เคย Trusted บัญชี A ต้องผ่าน 2FA ของ B; ไม่ใช้ trust ข้ามบัญชี
- [ ] หน้า Login ไม่เก็บ TOTP, Recovery Code, Secret หรือ Session Token ใน localStorage
- [ ] ทดสอบ Login ใหม่, Login ซ้ำใน Trusted Browser, หมด Trust และสลับบัญชี
