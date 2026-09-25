# 21 — FE: หน้าจัดการบัญชีและการกู้ 2FA โดย ADMIN

**What to build:** ADMIN ช่วยรีเซ็ต 2FA/รหัสผ่านและจัดการ Role ได้จากหน้าจอที่บอกขั้นตอนชัด โดยไม่ถูกถาม TOTP เพิ่มตอนสร้าง ADMIN หรือเปลี่ยน Role

**Blocked by:** 08 — BE: ADMIN ช่วยกู้ 2FA และป้องกัน ADMIN คนสุดท้าย; 09 — BE: เปลี่ยน/รีเซ็ตรหัสผ่านพร้อมเพิกถอนสิทธิ์เดิม; 10 — BE: ปิดสมัครเองและคุมการสร้างบัญชี/เปลี่ยน Role; 12 — FE: API client กลาง, Same-origin proxy และคืนสถานะ Login; 15 — FE: ย้ายคำขอผู้ใช้/ข้อมูลอ้างอิงและ service ที่เหลือ

**Owner / change boundary:** Frontend ADMIN user-management actions และ security dialogs; ไม่แก้ shared API client หรือ self-service 2FA settings

**Status:** ready-for-agent

- [ ] Reset 2FA แสดงว่าต้องตรวจตัวตนนอกระบบก่อน ให้กรอกเหตุผลและ Step-up TOTP แล้วแจ้งผลว่าจะต้อง Enrollment ใหม่
- [ ] Admin reset password ขอ TOTP ครั้งเดียวต่อ Step-up window 5 นาที ไม่ถามซ้ำสำหรับหลายบัญชีในช่วงเดียว
- [ ] สร้าง ADMIN และเปลี่ยน Role ไม่แสดง TOTP prompt เพิ่ม; แสดงผลการเพิกถอน Session เป้าหมายอย่างเข้าใจได้
- [ ] แสดงข้อผิดพลาดเมื่อพยายามลบ/ปิดใช้งาน/ลด Role ADMIN คนสุดท้าย โดยไม่ปล่อยให้ UI คิดว่าบันทึกสำเร็จ
- [ ] การปิด public self-sign-up ไม่ทำให้หน้าสร้างผู้ใช้เดิมของ ADMIN เสีย
- [ ] ทดสอบ Flow ทั้งสำเร็จ, Step-up หมดอายุ, สิทธิ์ไม่พอ และกรณี ADMIN คนสุดท้าย
