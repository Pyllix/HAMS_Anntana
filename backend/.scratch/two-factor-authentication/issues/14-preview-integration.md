# 14 — FE + BE: ตรวจ Preview และเตรียมส่งมอบ

**What to build:** ทีมตรวจระบบ 2FA และ Cookie Session บน Vercel–Render Preview ครบวงจรก่อนเปิดใช้ Production

**Blocked by:** 06 — Session และ draft; 08 — ADMIN security; 09 — Bootstrap; 12 — 2FA entry; 13 — Browser token cutover

**Owner / change boundary:** Frontend นำการตรวจ Preview ร่วมกับ Backend owner เพื่อตรวจ API, database และ deployment

**Status:** in-progress — ตรวจอัตโนมัติและ Render แล้ว; ยังไม่ผ่าน release gate

**Delivery order:** ทำหลัง ticket ที่เป็น release gate เสร็จทั้งหมด; บันทึกผลและข้อบกพร่องก่อนอนุมัติ Production

## เกณฑ์ส่งมอบ

- [ ] Preview บน Vercel–Render ใช้ same-origin API proxy และ rewrite ก่อน SPA fallback; personalized response ไม่ถูก cache
- [ ] ตรวจ Set-Cookie, Secure/HttpOnly/SameSite, Sign-in, Sign-out, CSRF และ Browser ที่บล็อก third-party Cookies
- [ ] เดิน Flow ทุก Role รวม Enrollment, TOTP, Recovery Code, Trusted Browser, สลับบัญชี และ Role change
- [ ] ตรวจ timeout 60 นาที/12 ชั่วโมง, warning, draft ของบัญชีเดิม, password/2FA reset และการเพิกถอนทุกเครื่อง
- [ ] ตรวจ Handover check ของ ADMIN สองคนและไม่มี public self-sign-up หรือ token fallback เปิดค้าง
- [x] บันทึกผลทดสอบและข้อบกพร่องที่ยังเหลือก่อนอนุมัติเปิดใช้ Production

## ผลตรวจ 2026-09-29 (branch `feat/2fa-auth`, HEAD `fbfd2bf`)

| หัวข้อ | ผลที่ยืนยันได้ | สิ่งที่ยังขาด |
| --- | --- | --- |
| Frontend | 39/39 tests ผ่าน; Vite build ผ่าน; `vercel.json` rewrite `/api/:path*` ไป Render ก่อน SPA fallback และตั้ง `Cache-Control: no-store` | ยังยืนยัน HTTP response จริงผ่าน Vercel Preview ไม่ได้ เพราะ Preview ถูก Vercel Authentication ป้องกัน |
| Backend | 14/14 auth/users/bootstrap suites (122/122 tests) ผ่าน; Nest build ผ่าน | ชุดทดสอบ `two-factor.service.spec.ts` ต้องใช้ฐานทดสอบแยก; ฐาน local ปัจจุบันขาดคอลัมน์ `two_factor_auth.pending_secret_encrypted` |
| ฐาน Preview | Prisma migrations 21 รายการ ไม่มีรายการค้าง | ไม่มี |
| Session บน Render | CSRF 200, sign-in 200, session 200, อ่าน users 200 (28 รายการ), sign-out ไม่มี CSRF ได้ 403, sign-out พร้อม CSRF ได้ 200, แล้ว session หมด; cookie มี Secure/HttpOnly/SameSite=Lax | ยังไม่ทดสอบใน browser ที่บล็อก third-party cookies และผ่าน Vercel same-origin proxy |
| Role gate บน Render | ทดสอบ sign-in ครบ 7 role: ADMIN และ PARCEL_STAFF ถูกส่งไป verify 2FA; ASSET_CENTER_STAFF ไป enroll 2FA; อีก 4 role ได้ full session; sign-out สำเร็จทุก role | ยังไม่เดิน TOTP/recovery/trusted browser/account switch/role change ใน browser |
| อายุ session และการเพิกถอน | Unit tests ของ idle 60 นาทีและ absolute 12 ชั่วโมงผ่าน; โค้ดกำหนดค่าไว้ตรงตามเกณฑ์ | ยังไม่ทดสอบ warning, draft, reset รหัสผ่าน/2FA, revoke all devices และเวลาจริงใน Preview |
| ADMIN handover | พบ active ADMIN 2 บัญชี | มีเพียง 1 บัญชีที่ email verified และ enroll 2FA สำเร็จ; **ไม่ผ่านเกณฑ์ ADMIN พร้อมใช้ 2 คน** |
| ปิดทางเข้าเดิม | โค้ดปฏิเสธ public sign-up; frontend เรียก same-origin `/api` และไม่แนบ Authorization | ยังไม่ยืนยัน public sign-up และ bearer fallback ด้วยการทดสอบ integration บน Preview |

### ข้อจำกัดและงานที่ต้องทำก่อนปิด Ticket

1. ให้เจ้าของ ADMIN คนที่สองยืนยันอีเมลและ enroll 2FA ด้วยตนเอง แล้วตรวจอีกครั้งว่ามี ADMIN พร้อมใช้ 2 คน; ห้ามบันทึก TOTP secret หรือ recovery code ในรายงานนี้
2. เปิด Preview ที่ผ่าน Vercel Authentication แล้วเดิน flow ใน browser ทั้ง cookie, 2FA, recovery, trusted browser, สลับบัญชี, role change, warning/draft และ reset/revoke; บันทึกผลพร้อม browser/เวลา
3. จัดฐาน PostgreSQL สำหรับ integration tests ที่แยกจากฐานใช้งานและมี schema ล่าสุดก่อนรันชุด DB-backed; ค่า `TEST_DATABASE_URL` ในเครื่องขณะตรวจชี้ฐานเดียวกับ `DATABASE_URL` จึงไม่รันชุดนี้ต่อ
4. ตรวจ response จาก `/api` ผ่าน Vercel Preview ว่าถูก proxy และไม่ถูก cache จริง รวมถึงทดสอบ public sign-up และ Bearer fallback หลังผ่านข้อ 3 หรือด้วย Preview ที่เข้าถึงได้

**การตัดสินใจ:** ยังไม่อนุมัติ Production และยังไม่ปิด Ticket 14
