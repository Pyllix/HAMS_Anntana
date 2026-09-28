# 06 — BE + FE: อายุ Session, คำเตือน และ draft

**What to build:** Session หมดอายุตามเวลาจริง ผู้ใช้ได้รับคำเตือน และงานที่ยังไม่บันทึกปลอดภัยเมื่อหมดอายุหรือสลับบัญชี

**Blocked by:** 02 — Cookie Session และ CSRF

**Owner / change boundary:** Backend รับผิดชอบการบังคับอายุและ activity API; Frontend รับผิดชอบ warning, protected content และ draft ในแท็บเดิม

**Status:** Complete

**Delivery order:** Backend เริ่มหลัง 02; Frontend เริ่มหลัง ticket 10 มี Cookie client. ปิด ticket เมื่อ service tests ยืนยันการคำนวณ/เลื่อน deadline และ HTTP guard tests ยืนยัน `SESSION_EXPIRED` พร้อมการปฏิเสธ protected write หลังหมดอายุ; frontend session/draft policy tests ใช้เป็นการตรวจเสริมตาม test seam ที่ตกลง. ไม่กำหนด browser interaction E2E เป็น gate สำหรับ ticket นี้.


**Verification:** ตาม test seam ที่เลือกไว้: backend service + HTTP guard/endpoint tests รวมกรณีปฏิเสธ protected write หลังหมดอายุ (4 suites, 28/28 tests); frontend storage/request-policy unit tests (12/12), lint, build และ targeted TypeScript checks ผ่าน; unit tests ไม่ได้ exercise SessionLifecycle timer UI และไม่ได้รัน browser interaction E2E. Full backend suite ผ่าน 43 จาก 44 suites; 1 suite ล้ม 17 tests เพราะ database ที่เชื่อมอยู่ไม่มีคอลัมน์ two_factor_auth.enrollment_complete. ไม่ได้รัน database-backed E2E เพราะยังไม่ได้ตั้ง TEST_DATABASE_URL.

## Backend: อายุ Session และกิจกรรม

- [x] ฝั่ง Server บังคับ absolute expiry 12 ชั่วโมงนับจาก Sign-in แม้ผู้ใช้ยังใช้งาน
- [x] ฝั่ง Server บังคับ idle expiry 60 นาทีตามกิจกรรมที่ผู้ใช้เริ่มเอง; background polling หรือเปิดหน้าเฉย ๆ ไม่ต่อเวลา
- [x] การกดใช้งานต่อด้วย Session ที่ยังไม่หมดอายุเลื่อนเฉพาะ idle deadline ไม่เลื่อน absolute deadline
- [x] Session endpoint ให้ข้อมูลเวลาที่ Frontend ใช้เตือนได้โดยไม่เผย credential
- [x] ปิดแท็บหรือ Browser ไม่ Sign-out; Sign-out เพิกถอนทันที; หลายเครื่องคง Session แยกกัน
- [x] ทดสอบขอบเวลา 55/60 นาที, 12 ชั่วโมง, polling และการใช้งานต่อ

## Frontend: เตือนและต่อเวลา

- [x] การคลิก พิมพ์ เลื่อนหน้า และเปิดข้อมูลที่ผู้ใช้สั่งเองถูกส่งเป็นกิจกรรมตามสัญญา
- [x] Background polling และการเปิดหน้าเฉย ๆ ไม่ทำให้ UI หรือ Server ต่อเวลา
- [x] แจ้งเตือนก่อน idle expiry 5 นาที และปุ่มใช้งานต่อยืดเฉพาะ idle deadline
- [x] ที่ 12 ชั่วโมง absolute expiry ต้อง Login ใหม่แม้มีการใช้งานต่อ
- [x] ผูก SessionLifecycle เข้ากับ session deadline เพื่อเตือนก่อนหมดอายุ 5 นาที ต่อเฉพาะ idle เมื่อผู้ใช้กด และหมดอายุเมื่อผู้ใช้ไม่ตอบสนอง; build/targeted TypeScript ผ่าน (ไม่ได้รัน browser interaction E2E; ดู Verification)

## Frontend: ปกป้องเนื้อหาและ draft

- [x] เมื่อ Session หมดอายุ ซ่อนข้อมูลที่ป้องกันและหยุดคำขอแก้ข้อมูลทันทีจน Login ใหม่
- [x] เก็บข้อมูลฟอร์มที่ยังไม่บันทึกไว้เฉพาะแท็บที่ยังเปิดและคืนให้เฉพาะบัญชีเดิมหลัง Login
- [x] หากบัญชีอื่น Login ต้องล้าง draft และไม่แสดงฟอร์ม/ข้อมูลของบัญชีเดิม
- [x] ตรวจและปรับ draft storage เดิมไม่ให้ข้อมูลข้ามบัญชี แม้มี localStorage สำหรับข้อมูลที่ไม่ใช่ Session Token
- [x] เตือนก่อน Refresh/ปิดแท็บตามความสามารถ Browser และไม่สัญญาว่ากู้ draft หลังปิดแท็บได้
- [x] ผูก draft hook กับ Repair, Borrow, Asset และ Assessment (ผ่าน targeted TypeScript/build); shared storage tests ตรวจ same-account restore, account switch และ duplicate-tab isolation; HTTP guard ปฏิเสธ protected write หลัง Session หมดอายุ
