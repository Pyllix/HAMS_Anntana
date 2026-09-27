# 2FA implementation ticket map

**Source spec:** [2FA, Trusted Browser และ Web Session](spec.md)
**Status:** tickets 01–13 done; ticket 14 is the remaining Preview integration and Production release gate
**Release rule:** อย่าเปิดใช้ Production จน ticket 14 ผ่าน Preview ครบ

## วิธีทำงาน

- Ticket 01–05 เสร็จแล้วและคงไว้เป็นหลักฐานการทำงานเดิม
- Ticket 06–14 คือ 9 งานส่งมอบที่เหลือ; checklist ภายในแต่ละใบเก็บขอบเขตจาก ticket เดิมครบ
- Ticket 06–08 และ 13–14 คร่อม Backend/Frontend: กำหนดผู้รับผิดชอบหลักหนึ่งคนและส่งงานสอง repository ตาม Delivery order ในใบงาน
- ช่อง Blocked by ระบุเงื่อนไขเริ่มงาน; dependency ของขั้นย่อยระบุใน Delivery order เพื่อให้ Backend เริ่มได้โดยไม่ต้องรอ Frontend ที่ไม่เกี่ยวข้อง
- Ticket 10 เป็นเจ้าของ shared client/proxy; ticket 11 ย้าย service ทั้งสามกลุ่ม; ticket 06, 07 และ 12 ใช้ client ที่ส่งมอบแล้ว
- Ticket 02 เป็นขั้น expand ที่คงทางเดิมชั่วคราว; ticket 13 ปิด Browser token ฝั่ง Frontend ก่อนปิดฝั่ง Backend. ขั้นกลางยังไม่พร้อม Production

## Tickets

| ID | Owner | Ticket | Blocked by |
|---|---|---|---|
| 01 | BE | [ข้อตกลง API และจุดทดสอบจริง](issues/01-be-auth-contract.md) | — |
| 02 | BE | [Cookie Session และ CSRF](issues/02-be-cookie-session.md) | 01 |
| 03 | BE | [บังคับ Enrollment ตาม Role](issues/03-be-mandatory-enrollment.md) | 02 |
| 04 | BE | [Recovery Code และ lockout](issues/04-be-recovery-login-lockout.md) | 03 |
| 05 | BE | [Trusted Browser 14 วัน](issues/05-be-trusted-browser.md) | 03 |
| 06 | BE + FE | [อายุ Session, คำเตือน และ draft](issues/06-session-expiry-and-drafts.md) — **Complete** | 02 |
| 07 | BE + FE | [ผู้ใช้จัดการความปลอดภัยบัญชีตนเอง](issues/07-self-service-security.md) | 04, 05 |
| 08 | BE + FE | [ADMIN จัดการบัญชีและช่วยกู้สิทธิ์](issues/08-admin-account-security.md) | 03, 05 |
| 09 | BE | [Production bootstrap](issues/09-production-bootstrap.md) | 03 |
| 10 | FE | [Cookie client กลางและ proxy](issues/10-fe-shared-client-proxy.md) | 01, 02 |
| 11 | FE | [ย้าย service ทั้งหมดไป Cookie client](issues/11-fe-cookie-client-migration.md) | 10 |
| 12 | FE | [Enrollment และ Login ด้วย 2FA](issues/12-fe-two-factor-entry.md) | 03, 04, 05, 10 |
| 13 | FE + BE | [ปิด Browser token แบบเดิม](issues/13-browser-token-cutover.md) | 07, 08, 11, 12 |
| 14 | FE + BE | [ตรวจ Preview และเตรียมส่งมอบ](issues/14-preview-integration.md) | 06, 08, 09, 12, 13 |

## ลำดับที่เริ่มได้

1. หลัง 01–05 เสร็จแล้ว: เริ่ม 06 ฝั่ง Backend, 07 ฝั่ง Backend, งาน account/Role policy ของ 08, 09 และ 10 ได้
2. หลัง 10: เริ่ม 11 และ 12; เริ่มงาน Frontend ใน 06 และ 07 ได้
3. หลัง Step-up ฝั่ง Backend ของ 07 พร้อม: เริ่ม recovery และ ADMIN reset password ใน 08; หน้าจอ ADMIN ใช้ service จาก 11
4. หลัง 07, 08, 11 และ 12: ทำ 13 โดยย้าย Browser ก่อนปิดทาง token เดิมฝั่ง Backend
5. หลัง release gates ทั้งหมด: ทำ 14 บน Preview ก่อนพิจารณา Production

## มติที่ห้ามตีความกลับ

- การสร้าง ADMIN และการเปลี่ยน Role **ไม่ต้องกรอก TOTP เพิ่ม** แต่ยังต้องตรวจ ADMIN ฝั่ง Server, ทำ Audit และเพิกถอน Session/Trusted Browser ของผู้ถูกเปลี่ยน Role
- Step-up TOTP ยังคงใช้กับการเปลี่ยน/รีเซ็ต 2FA, สร้าง Recovery Codes ใหม่ และ ADMIN reset password
- Trusted Browser ช่วยข้าม TOTP ตอน Login เท่านั้น ไม่ยืดอายุ Session
