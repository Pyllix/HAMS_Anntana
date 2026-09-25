# 10 — BE: ปิดสมัครเองและคุมการสร้างบัญชี/เปลี่ยน Role

**What to build:** เฉพาะ ADMIN จัดการบัญชีพนักงานผ่านขั้นตอน HAMS ได้ โดยช่องสมัครเองหรือ BetterAuth route ตรงไม่สามารถข้ามนโยบายของโรงพยาบาล

**Blocked by:** 03 — BE: บังคับ Enrollment 2FA ตาม Role; 05 — BE: Trusted Browser 14 วันแบบแยกบัญชี; 08 — BE: ADMIN ช่วยกู้ 2FA และป้องกัน ADMIN คนสุดท้าย

**Owner / change boundary:** Backend account creation, Role policy, direct-route protection และ Audit Log; ไม่แก้หน้าจอเพิ่มผู้ใช้

**Status:** ready-for-agent

- [ ] ปิด public email self-sign-up แต่การเพิ่มผู้ใช้ของ ADMIN ยังทำงานและส่งอีเมลยืนยันได้
- [ ] ทุกช่องสร้างบัญชี/เปลี่ยน Role รวมถึง BetterAuth route ตรงต้องตรวจ ADMIN ฝั่ง Server และข้อกำหนดข้อมูลพนักงาน
- [ ] สร้าง ADMIN หรือเปลี่ยน Role ใด ๆ ได้โดยไม่บังคับ Step-up TOTP เพิ่ม; บันทึก Audit Log ที่ระบุ actor/target/การเปลี่ยนแปลง
- [ ] Role change เพิกถอนทุก Session และ Trusted Browser ของเป้าหมายทันที แล้ว Login ครั้งต่อไปใช้กฎ Role ใหม่
- [ ] การแก้ข้อมูลโปรไฟล์ที่ไม่ได้เปลี่ยน Role ไม่ถูกเพิกถอนด้วยเหตุนี้
- [ ] การลบ/ปิดใช้งาน/ลด Role ของ ADMIN คนสุดท้ายยังถูกปฏิเสธ; ไม่มี forced first-login password change
- [ ] ทดสอบทั้งช่อง HAMS และ BetterAuth route ตรงกับ ADMIN และผู้ไม่มีสิทธิ์
