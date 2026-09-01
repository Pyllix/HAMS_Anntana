# 🧪 คู่มือและรายการทดสอบระบบงานซ่อมแบบครอบคลุม (Comprehensive Manual Test Cases)

เอกสารรวบรวม Test Cases สำหรับการทดสอบแบบ Manual Test ครบทุก Flow การซ่อมทั้ง 5 รูปแบบ (`SELF_REPAIR`, `INTERNAL_STOCK`, `EXTERNAL_STOCK`, `OUTSOURCE`, `PURCHASE_REPLACEMENT`) พร้อมทั้ง Edge Cases, การตัดสต็อกอะไหล่, และการตรวจสอบสิทธิ์ความปลอดภัยแบบแยกหน้าที่ชัดเจน (Strict Separation of Duties & RBAC)

---

## 📋 สารบัญเคสการทดสอบ (Test Scenarios Index)

1. [Pre-requisite: ข้อมูลตั้งต้นสำหรับทดสอบ](#1-pre-requisite-ข้อมูลตั้งต้นสำหรับทดสอบ)
2. [Test Suite 1: Flow การซ่อมแซมเองภายใน (SELF_REPAIR)](#2-test-suite-1-flow-การซ่อมแซมเองภายใน-self_repair)
3. [Test Suite 2: Flow เบิกใช้อะไหล่ในคลัง (INTERNAL_STOCK)](#3-test-suite-2-flow-เบิกใช้อะไหล่ในคลัง-internal_stock)
4. [Test Suite 3: Flow สั่งซื้อ/เบิกอะไหล่นอกคลัง (EXTERNAL_STOCK)](#4-test-suite-3-flow-สั่งซื้อเบิกอะไหล่นอกคลัง-external_stock)
5. [Test Suite 4: Flow ส่งซ่อมบริษัทภายนอก (OUTSOURCE)](#5-test-suite-4-flow-ส่งซ่อมบริษัทภายนอก-outsource)
6. [Test Suite 5: Flow แทงชำรุด/ขอซื้อเครื่องทดแทน (PURCHASE_REPLACEMENT - 10 Steps)](#6-test-suite-5-flow-แทงชำรุดขอซื้อเครื่องทดแทน-purchase_replacement---10-steps)
7. [Test Suite 6: Edge Cases & Validation Rules](#7-test-suite-6-edge-cases--validation-rules)
8. [Test Suite 7: ตรวจสอบสิทธิ์ผู้ใช้งานและ Separation of Duties (RBAC)](#8-test-suite-7-ตรวจสอบสิทธิ์ผู้ใช้งานและ-separation-of-duties-rbac)

---

## 1. Pre-requisite: ข้อมูลตั้งต้นสำหรับทดสอบ

ก่อนเริ่มทดสอบ ให้มั่นใจว่าได้รัน Seed ข้อมูลเรียบร้อยแล้ว:
```powershell
pnpm prisma db seed
```
- **บัญชีทดสอบที่ต้องเตรียม:**
  - `DEPARTMENT_STAFF`: ผู้ใช้งานแผนกผู้แจ้งซ่อม (เช่น พยาบาล)
  - `MAINTENANCE_STAFF`: ช่างผู้รับผิดชอบงานซ่อม
  - `PARCEL_STAFF`: เจ้าหน้าที่พัสดุ
  - `MANAGER`: ผู้บริหาร/ผู้อนุมัติ
  - `ADMIN`: ผู้ดูแลระบบ (ไม่มีสิทธิ์กดอนุมัติ Step 5/6)

---

## 2. Test Suite 1: Flow การซ่อมแซมเองภายใน (`SELF_REPAIR` - 6 Steps)

| Test ID | ขั้นตอนการทดสอบ (Test Steps) | ข้อมูลนำเข้า (Input Data) | ผลลัพธ์ที่คาดหวัง (Expected Results) | สถานะที่ต้องเปลี่ยน |
|---|---|---|---|:---:|
| **TC-SELF-01** | หน่วยงานแจ้งซ่อม (`POST /repairs`) | `assetId`, `symptom: "น็อตยึดฝาครอบหลวม"`, `urgencyStatus: "NORMAL"` | สร้าง Job สำเร็จ ได้รหัส `REP-YYYYMM-XXXX`<br/>- ครุภัณฑ์เปลี่ยนเป็น `UNDER_REPAIR` / `UNAVAILABLE`<br/>- Step 1 (วันแจ้งซ่อม) มี `completeAt` ทันที | `PENDING_ASSIGN` |
| **TC-SELF-02** | ช่างเปิดรับงาน & วินิจฉัย (`PATCH /repairs/:id/diagnose`) | `diagnosis: "ขันน็อตให้แน่น"`, `solution: "ยึดน็อตใหม่"`, `stepActionType: "SELF_REPAIR"` | บันทึกสำเร็จ<br/>- สร้าง Steps 1-6<br/>- Steps 1-3 มี `completeAt` ทันที<br/>- JobStatus เปลี่ยนเป็น `IN_PROGRESS` | `IN_PROGRESS` |
| **TC-SELF-03** | ช่างดำเนินการซ่อมเสร็จ (`PATCH /repairs/:id/steps/4`) | `note: "ขันน็อตและทดสอบแรงยึดเรียบร้อย"` | Step 4 มี `completeAt` บันทึกเวลาปัจจุบัน | `IN_PROGRESS` |
| **TC-SELF-04** | ช่างแจ้งงานแล้วเสร็จ (`PATCH /repairs/:id/steps/5`) | `note: "แจ้งหน่วยงานให้มารับเครื่องทดสอบ"` | Step 5 มี `completeAt`<br/>- JobStatus เปลี่ยนเป็น `WAITING_DELIVERY` อัตโนมัติ | `WAITING_DELIVERY` 🔔 |
| **TC-SELF-05** | หน่วยงานตรวจรับคืน (`PATCH /repairs/:id/steps/6`) | `note: "ตรวจรับเครื่องเรียบร้อย ใช้งานได้ปกติ"` | Step 6 มี `completeAt`<br/>- JobStatus เปลี่ยนเป็น `COMPLETED`<br/>- ครุภัณฑ์กลับคืนสถานะเป็น `NORMAL` และ `AVAILABLE` | `COMPLETED` ✅ |

---

## 3. Test Suite 2: Flow เบิกใช้อะไหล่ในคลัง (`INTERNAL_STOCK` - 9 Steps)

| Test ID | ขั้นตอนการทดสอบ (Test Steps) | สิทธิ์ผู้ทำ (Role) | ข้อมูลนำเข้า | ผลลัพธ์ที่คาดหวัง | สถานะงาน |
|---|---|:---:|---|---|:---:|
| **TC-INT-01** | แจ้งซ่อม (`POST /repairs`) | `DEPARTMENT_STAFF` | `assetId`, `symptom: "เปิดไม่ติด มีกลิ่นไหม้"` | สร้าง Job สำเร็จ | `PENDING_ASSIGN` |
| **TC-INT-02** | ช่างวินิจฉัยระบุอะไหล่ (`PATCH /repairs/:id/diagnose`) | `MAINTENANCE_STAFF` | `stepActionType: "INTERNAL_STOCK"`, `spareParts: [{ sparepartId: 1, qty: 2 }]` | สร้าง Steps 1-9<br/>- Steps 1-4 auto-complete | `PARCEL_PROCESSING` 📦 |
| **TC-INT-03** | หัวหน้าอนุมัติเบิก (`PATCH /repairs/:id/steps/5`) | `PARCEL_STAFF` หรือ `MANAGER` | `note: "อนุมัติให้เบิกอะไหล่ตามจำนวน"` | Step 5 complete (บันทึกผู้อนุมัติ) | `PARCEL_PROCESSING` |
| **TC-INT-04** | พัสดุจ่ายอะไหล่ (`PATCH /repairs/:id/steps/6`) | `PARCEL_STAFF` | `note: "จ่ายอะไหล่ให้ช่างเรียบร้อย"` | Step 6 complete ➔ Job เป็น `IN_PROGRESS` | `IN_PROGRESS` 🔧 |
| **TC-INT-05** | ช่างบันทึกตัดสต็อกจริง (`POST /repairs/:id/spare-parts/withdraw`) | `MAINTENANCE_STAFF` | `sparepartId: 1`, `qty: 2` | สต็อกลดลง 2 ชิ้น บันทึก `SPAREPART_TXN: WITHDRAW` | `IN_PROGRESS` |
| **TC-INT-06** | ช่างคืนอะไหล่ที่ใช้ไม่หมด (`POST /repairs/:id/spare-parts/return`) | `MAINTENANCE_STAFF` | `sparepartId: 1`, `qty: 1` | สต็อกเพิ่มขึ้น 1 ชิ้น บันทึก `SPAREPART_TXN: RETURN` | `IN_PROGRESS` |
| **TC-INT-07** | ช่างรับอะไหล่และซ่อมเสร็จ (`PATCH /repairs/:id/steps/7`) | `MAINTENANCE_STAFF` | `note: "เปลี่ยนอะไหล่เรียบร้อย"` | Step 7 complete | `IN_PROGRESS` |
| **TC-INT-08** | ช่างแจ้งส่งมอบ (`PATCH /repairs/:id/steps/8`) | `MAINTENANCE_STAFF` | `note: "ซ่อมเสร็จ รอหน่วยงานตรวจรับ"` | Step 8 complete ➔ Job เป็น `WAITING_DELIVERY` | `WAITING_DELIVERY` 🔔 |
| **TC-INT-09** | ตรวจรับคืน & ปิดงาน (`PATCH /repairs/:id/steps/9`) | `DEPARTMENT_STAFF` | `note: "ตรวจรับเรียบร้อย"` | Job เป็น `COMPLETED` ➔ ครุภัณฑ์กลับมาพร้อมใช้ | `COMPLETED` ✅ |

---

## 4. Test Suite 3: Flow สั่งซื้อ/เบิกอะไหล่นอกคลัง (`EXTERNAL_STOCK` - 9 Steps)

| Test ID | ขั้นตอนการทดสอบ (Test Steps) | สิทธิ์ผู้ทำ (Role) | ข้อมูลนำเข้า | ผลลัพธ์ที่คาดหวัง | สถานะงาน |
|---|---|:---:|---|---|:---:|
| **TC-EXT-01** | แจ้งซ่อม (`POST /repairs`) | `DEPARTMENT_STAFF` | `assetId`, `symptom: "สายพานมอเตอร์ขาด"` | สร้าง Job สำเร็จ | `PENDING_ASSIGN` |
| **TC-EXT-02** | ช่างวินิจฉัยเลือกซื้อนอก (`PATCH /repairs/:id/diagnose`) | `MAINTENANCE_STAFF` | `stepActionType: "EXTERNAL_STOCK"` | สร้าง Steps 1-9 (1-4 auto-complete) | `PARCEL_PROCESSING` 📦 |
| **TC-EXT-03** | ผู้อนุมัติสั่งซื้อนอก (`PATCH /repairs/:id/steps/5`) | `PARCEL_STAFF` / `MANAGER` | `note: "อนุมัติจัดซื้อสายพาน"` | Step 5 complete ➔ Job เป็น `WAITING_PARTS` | `WAITING_PARTS` ⏳ |
| **TC-EXT-04** | พัสดุแจ้งรับอะไหล่เข้าคลัง (`PATCH /repairs/:id/steps/6`) | `PARCEL_STAFF` | `note: "พัสดุตรวจรับของเข้าเรียบร้อย"` | Step 6 complete ➔ Job เป็น `PARCEL_PROCESSING` | `PARCEL_PROCESSING` 📦 |
| **TC-EXT-05** | ช่างรับอะไหล่ไปซ่อม (`PATCH /repairs/:id/steps/7`) | `MAINTENANCE_STAFF` | `note: "ช่างรับสายพานมาประกอบ"` | Step 7 complete ➔ Job เป็น `IN_PROGRESS` | `IN_PROGRESS` 🔧 |
| **TC-EXT-06** | แจ้งแล้วเสร็จ (`PATCH /repairs/:id/steps/8`) | `MAINTENANCE_STAFF` | `note: "ทดสอบพร้อมส่งมอบ"` | Step 8 complete ➔ Job เป็น `WAITING_DELIVERY` | `WAITING_DELIVERY` 🔔 |
| **TC-EXT-07** | ปิดงาน (`PATCH /repairs/:id/steps/9`) | `DEPARTMENT_STAFF` | `note: "ปิดงานเรียบร้อย"` | Job เป็น `COMPLETED` ➔ ครุภัณฑ์ปกติ | `COMPLETED` ✅ |

---

## 5. Test Suite 4: Flow ส่งซ่อมบริษัทภายนอก (`OUTSOURCE` - 9 Steps)

| Test ID | ขั้นตอนการทดสอบ (Test Steps) | สิทธิ์ผู้ทำ (Role) | ข้อมูลนำเข้า | ผลลัพธ์ที่คาดหวัง | สถานะงาน |
|---|---|:---:|---|---|:---:|
| **TC-OUT-01** | แจ้งซ่อม (`POST /repairs`) | `DEPARTMENT_STAFF` | `assetId`, `symptom: "หัวตรวจคลื่นเสียงไม่ส่งสัญญาณ"` | สร้าง Job สำเร็จ | `PENDING_ASSIGN` |
| **TC-OUT-02** | ช่างวินิจฉัยเลือกส่งซ่อมนอก (`PATCH /repairs/:id/diagnose`) | `MAINTENANCE_STAFF` | `stepActionType: "OUTSOURCE"`, `companyId: "uuid"` | สร้าง Steps 1-9 (1-4 auto-complete) | `PARCEL_PROCESSING` 📦 |
| **TC-OUT-03** | อนุมัติส่งซ่อมบริษัท (`PATCH /repairs/:id/steps/5`) | `PARCEL_STAFF` / `MANAGER` | `note: "อนุมัติส่งศูนย์บริการ"` | Step 5 complete ➔ Job เป็น `OUTSOURCED` ทันที | `OUTSOURCED` 🚚 |
| **TC-OUT-04** | พัสดุรับเครื่องกลับจากบริษัท (`PATCH /repairs/:id/steps/6`) | `PARCEL_STAFF` | `note: "บริษัทนำเครื่องกลับมาส่ง"` | Step 6 complete ➔ Job เป็น `PARCEL_PROCESSING` | `PARCEL_PROCESSING` 📦 |
| **TC-OUT-05** | ช่างทดสอบ QC สอบเทียบ (`PATCH /repairs/:id/steps/7`) | `MAINTENANCE_STAFF` | `note: "ช่างสอบเทียบมาตรฐานผ่านเกณฑ์"` | Step 7 complete ➔ Job เป็น `IN_PROGRESS` | `IN_PROGRESS` 🔧 |
| **TC-OUT-06** | แจ้งแล้วเสร็จ (`PATCH /repairs/:id/steps/8`) | `MAINTENANCE_STAFF` | `note: "เครื่องพร้อมใช้งาน แจ้งหน่วยงาน"` | Step 8 complete ➔ Job เป็น `WAITING_DELIVERY` | `WAITING_DELIVERY` 🔔 |
| **TC-OUT-07** | ปิดงานบันทึกประกัน (`PATCH /repairs/:id/complete`) | `MAINTENANCE_STAFF` | `warrantyDate: "2027-09-01"`, `receiverId: "uuid"` | Job เป็น `COMPLETED` บันทึกประกัน | `COMPLETED` ✅ |

---

## 6. Test Suite 5: Flow แทงชำรุด/ขอซื้อเครื่องทดแทน (`PURCHASE_REPLACEMENT` - 10 Steps with Two-tier Approval)

| Test ID | ขั้นตอนการทดสอบ (Test Steps) | สิทธิ์ผู้ทำ (Role) | ข้อมูลนำเข้า | ผลลัพธ์ที่คาดหวัง | สถานะงาน |
|---|---|:---:|---|---|:---:|
| **TC-REP-01** | แจ้งซ่อม (`POST /repairs`) | `DEPARTMENT_STAFF` | `assetId`, `symptom: "บอร์ดไหม้ ตัวถังแตกหัก สภาพเสียหายสิ้นเชิง"` | สร้าง Job สำเร็จ | `PENDING_ASSIGN` |
| **TC-REP-02** | ช่างวินิจฉัยแทงชำรุด (`PATCH /repairs/:id/diagnose`) | `MAINTENANCE_STAFF` | `stepActionType: "PURCHASE_REPLACEMENT"` | สร้าง Steps 1-10 (1-4 auto-complete) ➔ Job เป็น `UNREPAIRABLE` | `UNREPAIRABLE` 🏷️ |
| **TC-REP-03** | **Step 5: พัสดุตรวจสอบและเสนอความเห็น** | **`PARCEL_STAFF`** | `note: "พัสดุตรวจสอบแล้วเห็นชอบให้จัดซื้อเครื่องใหม่ทดแทน"` | Step 5 complete (บันทึกพัสดุผู้ตรวจ) ➔ Job เป็น `PARCEL_PROCESSING` | `PARCEL_PROCESSING` 📦 |
| **TC-REP-04** | **Step 6: ผู้บริหารอนุมัติการจัดซื้อเครื่องทดแทน** | **`MANAGER`** | `note: "อนุมัติจัดซื้อครุภัณฑ์ใหม่ตามงบประมาณปี 2026"` | Step 6 complete (บันทึกผู้บริหารผู้อนุมัติ) | `PARCEL_PROCESSING` 📦 |
| **TC-REP-05** | Step 7: พัสดุรับเครื่องใหม่เข้าคลัง | `PARCEL_STAFF` | `note: "พัสดุรับเครื่องใหม่เข้าระบบทะเบียน"` | Step 7 complete | `PARCEL_PROCESSING` 📦 |
| **TC-REP-06** | Step 8: ช่างรับเครื่องใหม่และตั้งค่าส่งมอบ | `MAINTENANCE_STAFF` | `note: "ติดตั้งและตั้งค่าเครื่องใหม่พร้อมส่งมอบ"` | Step 8 complete ➔ Job เป็น `IN_PROGRESS` | `IN_PROGRESS` 🔧 |
| **TC-REP-07** | Step 9: แจ้งส่งมอบเครื่องใหม่ | `MAINTENANCE_STAFF` | `note: "แจ้งหน่วยงานเตรียมรับเครื่องใหม่"` | Step 9 complete ➔ Job เป็น `WAITING_DELIVERY` | `WAITING_DELIVERY` 🔔 |
| **TC-REP-08** | Step 10: ตรวจรับเครื่องใหม่ & ปิดงาน | `DEPARTMENT_STAFF` | `note: "หน่วยงานรับเครื่องใหม่เรียบร้อย"` | Job เป็น `COMPLETED`<br/>- **เครื่องเดิมเปลี่ยนเป็น `WAIT_DISPOSAL` / `UNAVAILABLE`** | `COMPLETED` ✅ |

---

## 7. Test Suite 6: Edge Cases & Validation Rules

| Test ID | เงื่อนไขการทดสอบ (Edge Case Scenario) | การกระทำ (Action) | ผลลัพธ์ที่คาดหวัง (Expected Results) |
|---|---|---|---|
| **TC-ERR-01** | ขอเบิกอะไหล่เกินยอดคงเหลือในคลัง (`INTERNAL_STOCK`) | `PATCH /repairs/:id/diagnose` ระบุอะไหล่ `qty: 999` (ในคลังมี 5) | ❌ **HTTP 400 Bad Request** |
| **TC-ERR-02** | เลือก `OUTSOURCE` แต่ไม่ได้ส่ง `companyId` | `PATCH /repairs/:id/diagnose` เลือก `stepActionType: OUTSOURCE` โดยไม่มี `companyId` | ❌ **HTTP 400 Bad Request** |
| **TC-ERR-03** | พยายามแก้ไขใบงานที่ปิดงานไปแล้ว (`COMPLETED`) | `PATCH /repairs/:id/diagnose` บน Job ที่เป็น `COMPLETED` | ❌ **HTTP 400 Bad Request** |
| **TC-ERR-04** | อัปเดต Step ที่ไม่มีอยู่ใน Job | `PATCH /repairs/:id/steps/99` | ❌ **HTTP 404 Not Found** |
| **TC-ERR-05** | คืนอะไหล่เกินจำนวนที่เคยเบิก | เบิกอะไหล่ 2 ชิ้น แต่เรียก API คืน `qty: 5` | ❌ **HTTP 400 Bad Request** |
| **TC-ERR-06** | แจ้งซ่อมครุภัณฑ์ที่ไม่มีอยู่ในระบบ | `POST /repairs` ด้วย `assetId` ที่ไม่มีอยู่จริง | ❌ **HTTP 404 Not Found** |

---

## 8. Test Suite 7: ตรวจสอบสิทธิ์ผู้ใช้งานและ Separation of Duties (RBAC)

| Test ID | การทดสอบ / ขั้นตอน | Role ที่ใช้ยิง API | สิทธิ์ที่คาดหวัง | ผลลัพธ์ที่คาดหวัง |
|---|---|:---:|:---:|:---:|
| **TC-SEC-01** | **ADMIN พยายามกดวินิจฉัย/วางแผนเคส (`PATCH :id/diagnose`)** | `ADMIN` | **ไม่มีสิทธิ์ (Strict Forbidden)** | ❌ **HTTP 403 Forbidden** |
| **TC-SEC-02** | **ADMIN พยายามกดอนุมัติใน Step 5 (Stock/Outsource)** | `ADMIN` | **ไม่มีสิทธิ์ (Strict Forbidden)** | ❌ **HTTP 403 Forbidden** |
| **TC-SEC-03** | **ADMIN พยายามกดอนุมัติซื้อทดแทนใน Step 6 (Replacement)** | `ADMIN` | **ไม่มีสิทธิ์ (Strict Forbidden)** | ❌ **HTTP 403 Forbidden** |
| **TC-SEC-04** | **ADMIN พยายามกดปิดงานส่งมอบคืนใน Step สุดท้าย** | `ADMIN` | **ไม่มีสิทธิ์ (Strict Forbidden)** | ❌ **HTTP 403 Forbidden** |
| **TC-SEC-05** | **ช่าง (MAINTENANCE_STAFF) พยายามกดอนุมัติใน Step 5** | `MAINTENANCE_STAFF` | **ไม่มีสิทธิ์ (Forbidden)** | ❌ **HTTP 403 Forbidden** |
| **TC-SEC-06** | พัสดุ (PARCEL_STAFF) กดอนุมัติใน Step 5 | `PARCEL_STAFF` | **มีสิทธิ์** | ✅ **HTTP 200 OK** |
| **TC-SEC-07** | ผู้บริหาร (MANAGER) กดอนุมัติซื้อทดแทนใน Step 6 | `MANAGER` | **มีสิทธิ์** | ✅ **HTTP 200 OK** |
| **TC-SEC-08** | ช่าง (MAINTENANCE_STAFF) กดยืนยันการซ่อมและปิดงาน | `MAINTENANCE_STAFF` | **มีสิทธิ์** | ✅ **HTTP 200 OK** |

---

## 📝 ตารางสรุป Check Sheet สำหรับผู้ทดสอบ (Tester Sign-off Sheet)

| หมวดการทดสอบ (Test Category) | จำนวน Test Cases | ผ่าน (Passed) | ไม่ผ่าน (Failed) | ผู้ทดสอบ (Tester) | วันที่ทดสอบ |
|---|:---:|:---:|:---:|---|---|
| 1. SELF_REPAIR Flow | 5 Cases | [ ] | [ ] | | |
| 2. INTERNAL_STOCK Flow | 9 Cases | [ ] | [ ] | | |
| 3. EXTERNAL_STOCK Flow | 7 Cases | [ ] | [ ] | | |
| 4. OUTSOURCE Flow | 7 Cases | [ ] | [ ] | | |
| 5. PURCHASE_REPLACEMENT (10 Steps) | 8 Cases | [ ] | [ ] | | |
| 6. Edge Cases & Validations | 6 Cases | [ ] | [ ] | | |
| 7. Separation of Duties & RBAC | 7 Cases | [ ] | [ ] | | |
| **รวมทั้งหมด** | **49 Cases** | | | | |
