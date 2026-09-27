# 08 — BE + FE: ADMIN จัดการบัญชีและช่วยกู้สิทธิ์

**What to build:** ADMIN จัดการบัญชีและ Role รีเซ็ต 2FA/รหัสผ่านให้ผู้อื่น พร้อม Audit, Step-up เฉพาะงานที่กำหนด และป้องกัน ADMIN คนสุดท้าย

**Blocked by:** 03 — บังคับ Enrollment; 05 — Trusted Browser (งานกู้ 2FA และ ADMIN reset password รอ Step-up ฝั่ง Backend ของ ticket 07 ภายในงาน)

**Owner / change boundary:** Backend รับผิดชอบ recovery, account/role policy, audit และ revocation; Frontend รับผิดชอบหน้าจอ ADMIN; ticket 11 เป็นเจ้าของ service client กลาง

**Status:** backend and frontend implemented; targeted tests, the fully migrated backend suite, and browser flows pass.

**Delivery order:** Backend recovery เริ่มเมื่อ Step-up ของ 07 พร้อม; งาน account/role policy ที่ไม่พึ่ง Step-up เริ่มได้หลัง 03 และ 05. Frontend เริ่มหลัง ticket 10 และ 11

## Backend: ช่วยกู้ 2FA และป้องกัน ADMIN คนสุดท้าย

- [x] ผู้ช่วยต้องเป็น ADMIN คนอื่นที่มี Session ถูกต้อง ผ่าน Step-up TOTP; เป้าหมายต้องเป็น Role ที่บังคับ 2FA และระบุเหตุผล/หลักฐานการตรวจตัวจริงนอกระบบ
- [x] ไม่อนุญาตรีเซ็ต 2FA ของตนเองผ่านช่อง assisted recovery
- [x] รีเซ็ตแล้วเพิกถอนทุก Session/Trusted Browser ของเป้าหมาย ทำลาย Secret/Recovery Codes เดิม และส่งกลับเข้า Enrollment Gate
- [x] บันทึก actor, target, เวลา และเหตุผลใน Audit Log พร้อมส่งอีเมลแจ้งเจ้าของบัญชี
- [x] ห้ามลบ ปิดใช้งาน หรือเปลี่ยน Role ของ ADMIN คนสุดท้ายที่ยัง active และ enroll แล้ว; ไม่บังคับให้ต้องมีสองคนทุกขณะหลังเปิดระบบ
- [x] ทดสอบกรณีเหลือ ADMIN พร้อมใช้งานหนึ่งคนระหว่างอีกคนกู้บัญชี และป้องกันการเหลือศูนย์

## Backend: ADMIN reset password

- [x] ADMIN reset password ต้องผ่าน Step-up TOTP แม้ Browser Trusted แล้ว และเพิกถอน Session/Trusted Browser ทั้งหมดของเป้าหมาย
- [x] ADMIN ใช้ Step-up ที่สำเร็จครั้งเดียวกับการรีเซ็ตรหัสผ่านหลายบัญชีภายใน 5 นาที โดยไม่ข้าม Session
- [x] หลัง ADMIN reset Login ครั้งถัดไปของ Role ที่บังคับต้องพิสูจน์ 2FA ใหม่ก่อนเลือก Trust ได้อีกครั้ง
- [x] ทดสอบหลายอุปกรณ์ หน้าต่าง Step-up หมดอายุ และไม่มีรหัสผ่านใน Audit Log

## Backend: สร้างบัญชี เปลี่ยน Role และปิดช่องข้ามนโยบาย

- [x] ปิด public email self-sign-up แต่การเพิ่มผู้ใช้ของ ADMIN ยังทำงานและส่งอีเมลยืนยันได้
- [x] ทุกช่องสร้างบัญชี/เปลี่ยน Role รวมถึง BetterAuth route ตรงต้องตรวจ ADMIN ฝั่ง Server และข้อกำหนดข้อมูลพนักงาน
- [x] สร้าง ADMIN หรือเปลี่ยน Role ใด ๆ ได้โดยไม่บังคับ Step-up TOTP เพิ่ม; บันทึก Audit Log ที่ระบุ actor/target/การเปลี่ยนแปลง
- [x] Role change เพิกถอนทุก Session และ Trusted Browser ของเป้าหมายทันที แล้ว Login ครั้งต่อไปใช้กฎ Role ใหม่
- [x] การแก้ข้อมูลโปรไฟล์ที่ไม่ได้เปลี่ยน Role ไม่ถูกเพิกถอนด้วยเหตุนี้
- [x] การสร้างบัญชีไม่บังคับเปลี่ยนรหัสผ่านเริ่มต้นในการ Login ครั้งแรก
- [x] ทดสอบทั้งช่อง HAMS และ BetterAuth route ตรงกับ ADMIN และผู้ไม่มีสิทธิ์

## Frontend: หน้าจัดการบัญชีและกู้สิทธิ์

- [x] Reset 2FA แสดงว่าต้องตรวจตัวตนนอกระบบก่อน ให้กรอกเหตุผลและ Step-up TOTP แล้วแจ้งผลว่าจะต้อง Enrollment ใหม่
- [x] Admin reset password ขอ TOTP ครั้งเดียวต่อ Step-up window 5 นาที ไม่ถามซ้ำสำหรับหลายบัญชีในช่วงเดียว
- [x] สร้าง ADMIN และเปลี่ยน Role ไม่แสดง TOTP prompt เพิ่ม; แสดงผลการเพิกถอน Session เป้าหมายอย่างเข้าใจได้
- [x] แสดงข้อผิดพลาดเมื่อพยายามลบ/ปิดใช้งาน/ลด Role ADMIN คนสุดท้าย โดยไม่ปล่อยให้ UI คิดว่าบันทึกสำเร็จ
- [x] การปิด public self-sign-up ไม่ทำให้หน้าสร้างผู้ใช้เดิมของ ADMIN เสีย
- [x] ทดสอบ Flow ทั้งสำเร็จ, Step-up หมดอายุ, สิทธิ์ไม่พอ และกรณี ADMIN คนสุดท้าย

**Verification:** Backend targeted security/account tests pass (64 tests). All 20 migrations applied successfully to an isolated verification database and the backend suite passed 47 suites / 393 tests, including HAMS and direct BetterAuth authorization routes. Frontend tests, lint, build, and browser flows pass, including Step-up expiry, forbidden response, and last-ADMIN error handling. The existing local `hams_db` has 32 tables but no migration history, so it was left untouched.
