# 05 — BE: Trusted Browser 14 วันแบบแยกบัญชี

**What to build:** ผู้ใช้เลือกจำ Browser หลังผ่าน 2FA ได้ 14 วันโดยไม่ต้องกรอก TOTP ทุกครั้ง แต่บัญชีอื่นใน Browser profile เดียวกันไม่ได้รับสิทธิ์นี้

**Blocked by:** 03 — BE: บังคับ Enrollment 2FA ตาม Role

**Owner / change boundary:** Backend trusted-browser credential และ sign-in decision; ไม่แก้ Checkbox หรือหน้าล็อกอิน

**Status:** ready-for-agent

- [ ] ออก Trust เฉพาะเมื่อผู้ใช้เลือกเองหลังยืนยัน 2FA; ค่าเริ่มต้นคือไม่เลือก
- [ ] Trust หมดอายุแบบ absolute 14 วันจากวันที่ออก ไม่เลื่อนอายุเมื่อ Login ซ้ำ
- [ ] Credential ผูกทั้งบัญชีและ Browser profile; ใช้ข้ามบัญชีไม่ได้
- [ ] เมื่อบัญชี B ลงชื่อเข้าใน Browser profile ที่ไว้ใจบัญชี A อยู่ ให้เพิกถอน Trust ของ A และให้ B ผ่าน TOTP ก่อนเลือก Trust ของตน
- [ ] Trust ไม่ข้ามรหัสผ่านหรือยืดอายุ Web Session; ทดสอบเครื่องประจำ เครื่องที่ใช้ร่วมกัน และ Trust ที่หมดอายุ
