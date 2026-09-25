# 22 — FE: นำ token storage/Bearer ออกจากเว็บทั้งหมด

**What to build:** หน้าเว็บทั้งหมดใช้ Cookie Session อย่างเดียว ไม่เก็บหรือส่ง Session Token ผ่าน JavaScript อีก และพร้อมให้ Backend ปิดช่องทางเดิม

**Blocked by:** 13 — FE: ย้ายคำขอครุภัณฑ์และยืม-คืนไป Cookie client; 14 — FE: ย้ายคำของานซ่อมและอะไหล่ไป Cookie client; 15 — FE: ย้ายคำขอผู้ใช้/ข้อมูลอ้างอิงและ service ที่เหลือ; 17 — FE: ล็อกอินด้วย TOTP/Recovery Code และเลือก Trusted Browser; 20 — FE: หน้าตั้งค่าความปลอดภัยของเจ้าของบัญชี; 21 — FE: หน้าจัดการบัญชีและการกู้ 2FA โดย ADMIN

**Owner / change boundary:** Frontend final auth-state contraction และ repository-wide token audit; ไม่แก้ Backend

**Status:** ready-for-agent

- [ ] ไม่มีการเก็บ Session Token ใน localStorage/sessionStorage หรือ state ที่ serialize ค้างบน Browser
- [ ] ไม่มีบริการเว็บสร้าง Authorization Bearer จาก token เดิม และไม่มี direct Render URL ที่ข้าม API base path กลาง
- [ ] Login, reload, เปลี่ยนหน้า, Sign-out และงานหลักทุกกลุ่มทำงานด้วย Cookie Session
- [ ] ตรวจให้ token ที่เคยค้างใน Browser เก่าไม่ถูกนำกลับมาใช้อีก และล้างได้โดยไม่ลบ draft ของบัญชีอื่นโดยพลการ
- [ ] ทดสอบ Browser integration กับ Cookie, CSRF และการไม่มี token ใน network response/Browser storage
