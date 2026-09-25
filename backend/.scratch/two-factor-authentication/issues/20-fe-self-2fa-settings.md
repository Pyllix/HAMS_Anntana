# 20 — FE: หน้าตั้งค่าความปลอดภัยของเจ้าของบัญชี

**What to build:** ผู้ใช้เปลี่ยนรหัสผ่าน Authenticator หรือสร้าง Recovery Codes ชุดใหม่ได้จากหน้าตั้งค่าตนเอง โดยเข้าใจผลต่อ Session/Trusted Browser และไม่สามารถปิด 2FA ที่บังคับได้

**Blocked by:** 07 — BE: เปลี่ยน 2FA และสร้าง Recovery Codes ชุดใหม่; 09 — BE: เปลี่ยน/รีเซ็ตรหัสผ่านพร้อมเพิกถอนสิทธิ์เดิม; 12 — FE: API client กลาง, Same-origin proxy และคืนสถานะ Login

**Owner / change boundary:** Frontend self-service security settings; ไม่แก้หน้าจอ ADMIN recovery ของ ticket 21

**Status:** ready-for-agent

- [ ] เปลี่ยน Authenticator ด้วยรหัสผ่านเดิมและ TOTP ปัจจุบัน พร้อมยืนยันการผูกตัวใหม่ตามผล Server
- [ ] สร้าง Recovery Codes ชุดใหม่หลัง TOTP และแสดงชุดใหม่ครั้งเดียว พร้อมแจ้งว่าชุดเก่าใช้ไม่ได้
- [ ] เปลี่ยนรหัสผ่านตนเองโดยกรอกรหัสเดิม แล้วแสดงว่าคง Session ปัจจุบันไว้แต่เครื่องอื่นและ Trusted Browser ถูกเพิกถอน
- [ ] ไม่บังคับให้เปลี่ยนรหัสผ่านเริ่มต้นตอน Login ครั้งแรก; ผู้ใช้เข้าหน้านี้เมื่อเลือกเปลี่ยนเอง
- [ ] ไม่มีปุ่มหรือเส้นทางให้ Role ที่บังคับปิด 2FA
- [ ] Trusted Browser ไม่ทำให้ข้าม TOTP สำหรับการเปลี่ยน 2FA/รหัสกู้
- [ ] จัดการ Session/Step-up หมดอายุโดยไม่ค้างหน้าความปลอดภัยที่แสดงข้อมูลลับ
