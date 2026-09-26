# 2FA implementation ticket map

**Source spec:** [2FA, Trusted Browser และ Web Session](spec.md)
**Status:** ticket 01 done; ticket 02 is next (unblocked)
**Release rule:** อย่าเปิดใช้ Production จน ticket 24 ผ่าน Preview ครบ

## ขอบเขตเจ้าของงาน

- **Backend (01–11, 23):** สัญญา API, auth/session/2FA, การจัดการบัญชี, bootstrap และการปิด token แบบเดิม
- **Frontend (12–22, 24):** proxy/client กลาง, ย้าย service เป็นสามกลุ่มแยกกัน, หน้าจอ 2FA/Session/ADMIN และการทดสอบ Preview
- Ticket 01 เป็นจุดตกลงสัญญาเดียวกัน; ticket 02 และ 12 เป็นเจ้าของส่วนกลางคนละ repository ก่อนให้ทีมอื่นทำงานคู่ขนาน
- Ticket 13–15 แบ่ง service คนละกลุ่ม: ครุภัณฑ์/ยืม-คืน, ซ่อม/อะไหล่, ผู้ใช้/ข้อมูลอ้างอิง/อื่น ๆ ห้ามแต่ละกลุ่มแก้ shared client หรือ auth screens เอง
- Ticket 16–21 เป็นงานหน้าจอแยก flow; ticket 22 ตรวจล้าง token ทั้ง repository หลัง service และหน้าจอทั้งหมดพร้อม
- Ticket 02 เป็นขั้น **expand** ที่คงทางเดิมชั่วคราวเพื่อไม่ให้เว็บเก่าพัง; ticket 22 และ 23 เป็นขั้น **contract** ของ Frontend และ Backend ตามลำดับ ห้ามถือขั้นกลางว่า Production-ready
- งานที่มีการแก้ shared auth/server config ให้เจ้าของ ticket 02 ประสานการ merge; อย่าสร้าง blocker เพิ่มเพียงเพราะอาจแก้ไฟล์ใกล้กัน หากพฤติกรรมไม่ต้องรอกันจริง

## Tickets

| ID | Owner | Ticket | Blocked by |
|---|---|---|---|
| 01 | BE | [ข้อตกลง API และจุดทดสอบจริง](issues/01-be-auth-contract.md) | — |
| 02 | BE | [Cookie Session และ CSRF](issues/02-be-cookie-session.md) | 01 |
| 03 | BE | [บังคับ Enrollment ตาม Role](issues/03-be-mandatory-enrollment.md) | 02 |
| 04 | BE | [Recovery Code และ lockout](issues/04-be-recovery-login-lockout.md) | 03 |
| 05 | BE | [Trusted Browser 14 วัน](issues/05-be-trusted-browser.md) | 03 |
| 06 | BE + FE | [อายุ Session, คำเตือน และ draft](issues/06-session-expiry-and-drafts.md) | 02 |
| 07 | BE | [Self-service 2FA และ Step-up](issues/07-be-self-2fa-step-up.md) | 04 |
| 08 | BE | [ADMIN ช่วยกู้ 2FA](issues/08-be-admin-2fa-recovery.md) | 07 |
| 09 | BE | [Password lifecycle](issues/09-be-password-revocation.md) | 05, 07 |
| 10 | BE | [Account/Role guard](issues/10-be-account-role-guard.md) | 03, 05, 08 |
| 11 | BE | [Production bootstrap](issues/11-be-production-bootstrap.md) | 03 |
| 12 | FE | [Shared client และ proxy](issues/12-fe-shared-client-proxy.md) | 01, 02 |
| 13 | FE | [ย้าย Asset/Borrow client](issues/13-fe-asset-borrow-client.md) | 12 |
| 14 | FE | [ย้าย Repair/Spare client](issues/14-fe-repair-spare-client.md) | 12 |
| 15 | FE | [ย้าย User/Reference client](issues/15-fe-user-reference-client.md) | 12 |
| 16 | FE | [Enrollment UI](issues/16-fe-enrollment-ui.md) | 03, 12 |
| 17 | FE | [Login/Trusted Browser UI](issues/17-fe-login-trusted-browser-ui.md) | 04, 05, 16 |
| 18 | FE | [Session warning UI](issues/18-fe-session-warning.md) | 06, 12 |
| 19 | FE | [Protected drafts](issues/19-fe-protected-drafts.md) | 18 |
| 20 | FE | [Self-service security settings](issues/20-fe-self-2fa-settings.md) | 07, 09, 12 |
| 21 | FE | [ADMIN security actions](issues/21-fe-admin-security-actions.md) | 08, 09, 10, 12, 15 |
| 22 | FE | [ล้าง Browser token/Bearer](issues/22-fe-remove-browser-token.md) | 13, 14, 15, 17, 20, 21 |
| 23 | BE | [ปิด Browser token แบบเดิม](issues/23-be-retire-browser-token.md) | 22 |
| 24 | FE | [Preview integration](issues/24-fe-preview-integration.md) | 11, 19, 21, 22, 23 |

## Frontier / งานที่เริ่มได้เมื่อ blocker เสร็จ

1. เริ่มที่ **01** เพื่อให้ทั้งสอง repository ใช้สัญญาเดียวกัน
2. หลัง **02**: **03**, **06**, และ **12** เดินคู่ขนานได้
3. หลัง **03**: **04**, **05**, **11**, และ **16** (ถ้า 12 เสร็จ) เดินคู่ขนานได้
4. หลัง **12**: **13**, **14**, **15**, และงาน UI ที่ Backend dependency พร้อมแล้วแบ่งคนละพื้นที่ทำได้
5. ปิดฝั่ง Browser ที่ **22** ก่อนปิด token response ฝั่ง Backend ที่ **23**; จากนั้น **24** ตรวจระบบรวม

## มติที่ห้ามตีความกลับ

- การสร้าง ADMIN และการเปลี่ยน Role **ไม่ต้องกรอก TOTP เพิ่ม** แต่ยังต้องตรวจ ADMIN ฝั่ง Server, ทำ Audit และเพิกถอน Session/Trusted Browser ของผู้ถูกเปลี่ยน Role
- Step-up TOTP ยังคงใช้กับการเปลี่ยน/รีเซ็ต 2FA, สร้าง Recovery Codes ใหม่ และ ADMIN reset password
- Trusted Browser ช่วยข้าม TOTP ตอน Login เท่านั้น ไม่ยืดอายุ Session
