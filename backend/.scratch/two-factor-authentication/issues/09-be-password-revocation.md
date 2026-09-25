# 09 — BE: เปลี่ยน/รีเซ็ตรหัสผ่านพร้อมเพิกถอนสิทธิ์เดิม

**What to build:** ผู้ใช้เปลี่ยนรหัสผ่านเองได้โดยไม่เสียงานใน Session ปัจจุบัน และ ADMIN รีเซ็ตรหัสผ่านให้ผู้อื่นได้โดยตัดการเข้าถึงเดิมทุกเครื่อง

**Blocked by:** 05 — BE: Trusted Browser 14 วันแบบแยกบัญชี; 07 — BE: เปลี่ยน 2FA และสร้าง Recovery Codes ชุดใหม่

**Owner / change boundary:** Backend password lifecycle และ session/trust revocation; ไม่แก้หน้าจัดการบัญชี

**Status:** ready-for-agent

- [ ] Self-service password change ต้องตรวจรหัสผ่านเดิม คง Session ปัจจุบัน และเพิกถอน Session เครื่องอื่นกับ Trusted Browser ทุกเครื่อง
- [ ] ADMIN reset password ต้องผ่าน Step-up TOTP แม้ Browser Trusted แล้ว และเพิกถอน Session/Trusted Browser ทั้งหมดของเป้าหมาย
- [ ] ADMIN ใช้ Step-up ที่สำเร็จครั้งเดียวกับการรีเซ็ตรหัสผ่านหลายบัญชีภายใน 5 นาที โดยไม่ข้าม Session
- [ ] หลัง reset หรือ self-change Login ครั้งถัดไปของ Role ที่บังคับต้องพิสูจน์ 2FA ใหม่ก่อนเลือก Trust ได้อีกครั้ง
- [ ] ทดสอบหลายอุปกรณ์, ช่วงหมดอายุ Step-up และไม่มีการเผยรหัสผ่านใน Audit Log
