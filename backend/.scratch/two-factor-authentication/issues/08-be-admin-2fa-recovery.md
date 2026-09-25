# 08 — BE: ADMIN ช่วยกู้ 2FA และป้องกัน ADMIN คนสุดท้าย

**What to build:** เมื่อผู้ใช้ทำทั้ง Authenticator และ Recovery Codes หาย ADMIN อีกคนช่วยรีเซ็ตได้หลังตรวจตัวจริงนอกระบบ โดยบัญชีที่ถูกกู้ต้องตั้ง 2FA ใหม่ก่อนใช้งาน

**Blocked by:** 07 — BE: เปลี่ยน 2FA และสร้าง Recovery Codes ชุดใหม่

**Owner / change boundary:** Backend recovery command, audit/email และ last-admin invariant; ไม่แก้หน้าจอ ADMIN

**Status:** ready-for-agent

- [ ] ผู้ช่วยต้องเป็น ADMIN คนอื่นที่มี Session ถูกต้อง ผ่าน Step-up TOTP และระบุเหตุผล/หลักฐานการตรวจตัวจริงนอกระบบ
- [ ] ไม่อนุญาตรีเซ็ต 2FA ของตนเองผ่านช่อง assisted recovery
- [ ] รีเซ็ตแล้วเพิกถอนทุก Session/Trusted Browser ของเป้าหมาย ทำลาย Secret/Recovery Codes เดิม และส่งกลับเข้า Enrollment Gate
- [ ] บันทึก actor, target, เวลา และเหตุผลใน Audit Log พร้อมส่งอีเมลแจ้งเจ้าของบัญชี
- [ ] ห้ามลบ ปิดใช้งาน หรือเปลี่ยน Role ของ ADMIN คนสุดท้ายที่ยัง active และ enroll แล้ว; ไม่บังคับให้ต้องมีสองคนทุกขณะหลังเปิดระบบ
- [ ] ทดสอบกรณีเหลือ ADMIN พร้อมใช้งานหนึ่งคนระหว่างอีกคนกู้บัญชี และป้องกันการเหลือศูนย์
