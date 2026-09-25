# 07 — BE: เปลี่ยน 2FA และสร้าง Recovery Codes ชุดใหม่

**What to build:** เจ้าของบัญชีดูแล Authenticator และรหัสกู้ได้โดยต้องพิสูจน์ตัวตนใหม่ แต่ปิด 2FA ที่ Role บังคับไม่ได้

**Blocked by:** 04 — BE: ใช้ Recovery Code และจำกัดการเดา 2FA

**Owner / change boundary:** Backend 2FA lifecycle และ Step-up state; ไม่แก้หน้าตั้งค่าของ Frontend

**Status:** ready-for-agent

- [ ] ไม่มี API ที่ปล่อยให้ Role ที่บังคับปิด 2FA และกลับเข้า Business API โดยไม่มี Enrollment
- [ ] เปลี่ยน Authenticator ได้หลังยืนยันรหัสผ่านเดิมและ TOTP ปัจจุบัน; Secret ใหม่ไม่ถูกเปิดเผยแก่ ADMIN
- [ ] สร้าง Recovery Codes ชุดใหม่ต้องยืนยัน TOTP ปัจจุบัน; ชุดเก่าใช้ไม่ได้และชุดใหม่แสดงครั้งเดียว/เก็บเป็นแฮช
- [ ] Step-up ของ ADMIN ผูกกับบัญชีและ Session ปัจจุบัน มีอายุ 5 นาที ไม่ข้ามไปอีก Session
- [ ] Step-up สิ้นสุดเมื่อ Sign-out, Session ถูกเพิกถอน หรือ ADMIN เปลี่ยนรหัสผ่าน/2FA
- [ ] ทดสอบว่าการทำรายการเหล่านี้ยังขอ TOTP แม้ Browser ยัง Trusted
