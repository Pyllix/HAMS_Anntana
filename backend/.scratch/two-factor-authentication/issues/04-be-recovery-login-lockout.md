# 04 — BE: ใช้ Recovery Code และจำกัดการเดา 2FA

**What to build:** ผู้ใช้ที่ไม่มี Authenticator ชั่วคราวใช้ Recovery Code ได้หนึ่งครั้งต่อรหัส ขณะที่การเดารหัสผิดซ้ำถูกระงับชั่วคราวโดยไม่ล็อกบัญชีถาวร

**Blocked by:** 03 — BE: บังคับ Enrollment 2FA ตาม Role

**Owner / change boundary:** Backend 2FA verification และ attempt state; ไม่แก้ Enrollment UI

**Status:** done

- [x] Recovery Code ที่ถูกต้องใช้แทน TOTP ได้ครั้งเดียวและถูก consume แบบไม่เกิด race condition
- [x] ไม่คืน Recovery Code เดิมหรือข้อมูลที่ถอดกลับได้จากฐานข้อมูลใน API ใด
- [x] ความผิดพลาดของ TOTP และ Recovery Code นับรวมกัน; ผิดครบ 5 ครั้งระงับการตรวจ 2FA ของบัญชี 10 นาที
- [x] การตรวจสำเร็จล้างตัวนับ และเมื่อครบเวลาระงับผู้ใช้ลองใหม่ได้โดยไม่ต้องให้ ADMIN ปลดล็อก
- [x] บันทึกเหตุการณ์ lockout โดยไม่บันทึกค่ารหัส และทดสอบการใช้รหัสซ้ำ/พร้อมกัน/หมดอายุสถานะล็อก
