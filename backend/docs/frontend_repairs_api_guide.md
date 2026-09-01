# 📘 Frontend Developer Guide: Maintenance & Repair Module API

คู่มือการเชื่อมต่อ API โมดูลงานซ่อมบำรุงและจัดการสถานะ (Maintenance & Repair Job API) สำหรับ Frontend Developer

---

## 🧭 1. ภาพรวมสถาปัตยกรรม & ลำดับการทำงาน (Frontend Workflow Lifecycle)

ระบบแบ่งออกเป็น **3 ช่วงเวลาหลัก** ตามการใช้งานจริง:

```
[ช่วงที่ 1: แจ้งซ่อม] ────────▶ [ช่วงที่ 2: ฟอร์มช่างรับงาน & วินิจฉัย & วางแผน] ────────▶ [ช่วงที่ 3: ทยอยกดอัปเดตตามจริง]
  • หน่วยงานแจ้งซ่อม                • ธุรการ/ช่างกรอกฟอร์มเดียว รวดเดียว (Steps 2-4)          • ผู้อนุมัติ / พัสดุ / ช่าง / หน่วยงาน
  • POST /repairs                   • PATCH /repairs/:id/diagnose                              • PATCH /repairs/:id/steps/:stepNumber
  • Auto-complete Step 1            • Auto-complete Steps 1-4 ทันที                            • ทยอยกดตาม Event หน้างานจริง
```

---

## 🏷️ 2. ชุดสถานะงานซ่อม (`jobStatus.code`) สำหรับทำ Badge / Tab Filter

| Status Code | ชื่อสถานะ (ไทย) | แนะนำสี Badge | ความหมาย |
|---|---|:---:|---|
| **`WAITING_HANDOVER`** | รอรับเครื่องจากหน่วยงาน | 🟡 Yellow | แจ้งซ่อมแล้ว แต่ยังไม่ได้ยกเครื่องมาศูนย์ซ่อม |
| **`PENDING_ASSIGN`** | รอมอบหมายงานให้ช่าง | 🟠 Orange | ศูนย์ซ่อมได้รับเรื่องแล้ว อยู่ระหว่างจ่ายงานให้ช่าง |
| **`IN_PROGRESS`** | ช่างกำลังดำเนินการซ่อม | 🔵 Blue | ช่างรับงาน วินิจฉัย และกำลังซ่อมแซม/ทดสอบ |
| **`WAITING_PARTS`** | สั่งซื้อ/รออะไหล่ | 🟣 Purple | อนุมัติสั่งซื้อแล้ว กำลังรอร้านค้า/บริษัทส่งของ |
| **`PARCEL_PROCESSING`**| พัสดุกำลังดำเนินการ | 🟤 Brown | ติดขั้นตอนทางเอกสารพัสดุ / รออนุมัติ / ตรวจรับของเข้า |
| **`OUTSOURCED`** | ส่งซ่อมบริษัทภายนอก | 🚚 Cyan | เครื่องถูกส่งออกไปซ่อมที่บริษัทภายนอก |
| **`UNREPAIRABLE`** | แทงชำรุด/เห็นควรจำหน่าย | 🔴 Red | ช่างประเมินว่าซ่อมไม่คุ้ม เสนอซื้อเครื่องทดแทน |
| **`WAITING_DELIVERY`** | เสร็จแล้วรอรับคืน | 🟢 Light Green| ซ่อมเสร็จแล้ว แจ้งหน่วยงานให้มารับเครื่องคืน |
| **`COMPLETED`** | ส่งคืน/ดำเนินการเรียบร้อย| ❇️ Green | ตรวจรับเครื่องเรียบร้อย ปิด Job สมบูรณ์ |
| **`CANCELLED`** | ยกเลิกงานซ่อม | ⚫ Gray | ยกเลิกใบแจ้งซ่อม |

---

## 🛠️ 3. API Endpoints Reference

### 3.1 ดึงข้อมูล Master / Lookup สำหรับ Dropdown ในฟอร์ม
```http
GET /repairs/lookups/meta
```
- **Authentication:** `Bearer Token` (ทุก Role)
- **Response:**
  ```json
  {
    "causes": [{ "id": 1, "code": "01", "name": "การเสื่อมสภาพตามอายุการใช้งาน" }],
    "techCategories": [{ "id": 1, "code": "BIOMED", "name": "หมวดวิศวกรรมชีวการแพทย์" }],
    "jobTypes": [{ "id": 1, "name": "ตรวจเช็คและซ่อมทั่วไป" }],
    "jobStatuses": [{ "id": 1, "code": "PENDING_ASSIGN", "name": "รอมอบหมายงานให้ช่าง" }],
    "actionTypes": ["REPAIR", "FABRICATE", "MODIFY", "PREVENTIVE"],
    "stepActionTypes": ["SELF_REPAIR", "INTERNAL_STOCK", "EXTERNAL_STOCK", "OUTSOURCE", "PURCHASE_REPLACEMENT"],
    "urgencyStatuses": ["NORMAL", "URGENT", "EMERGENCY"],
    "reportTypes": ["Repair", "Maintenance"]
  }
  ```

---

### 3.2 ช่วงที่ 1: สร้างใบแจ้งซ่อมออนไลน์ (Create Repair Request)
```http
POST /repairs
```
- **สิทธิ์การใช้งาน:** `DEPARTMENT_STAFF`, `MAINTENANCE_STAFF`, `ADMIN`, `PARCEL_STAFF`, `ASSET_CENTER_STAFF`, `MANAGER`
- **Request Body:**
  ```json
  {
    "assetId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "symptom": "เปิดเครื่องไม่ติด มีกลิ่นไหม้",
    "urgencyStatus": "URGENT",
    "reportType": "Repair",
    "sectionId": " optional: ถ้าระบุจะ override แผนกผู้แจ้ง"
  }
  ```
- **Response (201 Created):**
  - ได้ `jobNo` (เช่น `REP-202609-0001`)
  - `jobStatus.code` ➔ **`PENDING_ASSIGN`**
  - ครุภัณฑ์ถูกปรับเป็น **`UNDER_REPAIR` / `UNAVAILABLE`** อัตโนมัติ

---

### 3.3 ช่วงที่ 2: ฟอร์มรับงาน & วินิจฉัย & วางแผนเคส (Diagnose & Plan) — **Single Submit**
> 📌 **Frontend Note:** หน้านี้ทำเป็น 1 ฟอร์มใหญ่ให้ช่างกรอกทุกอย่างรวดเดียว เมื่อกดบันทึก Backend จะบันทึกช่าง + ผลวินิจฉัย + Auto-complete Steps 1 ถึง 4 ให้ทันที!

```http
PATCH /repairs/:id/diagnose
```
- **สิทธิ์การใช้งาน:** `MAINTENANCE_STAFF`, `ADMIN`
- **Request Body (ตัวอย่างเคส INTERNAL_STOCK):**
  ```json
  {
    "diagnosis": "พาวเวอร์ซัพพลายช็อตและฟิวส์ขาด",
    "solution": "เปลี่ยนชุด Power Supply และฟิวส์ 10A",
    "causeId": 3,
    "techCategoryId": 1,
    "jobTypeId": 1,
    "actionType": "REPAIR",
    "stepActionType": "INTERNAL_STOCK",
    "dueDate": "2026-09-10T17:00:00.000Z",
    "isRepeatRepair": false,
    "mechanicIds": ["user-uuid-ช่างคนแรก", "user-uuid-ช่างคนที่สอง"],
    "spareParts": [
      { "sparepartId": 1, "qty": 1 },
      { "sparepartId": 5, "qty": 2 }
    ]
  }
  ```
- **Request Body (ตัวอย่างเคส OUTSOURCE):**
  ```json
  {
    "diagnosis": "บอร์ดประมวลผลหลักเสียหาย ไม่สามารถซ่อมภายในได้",
    "solution": "ส่งซ่อมศูนย์บริการผู้แทนจำหน่าย",
    "causeId": 4,
    "techCategoryId": 1,
    "jobTypeId": 2,
    "actionType": "REPAIR",
    "stepActionType": "OUTSOURCE",
    "companyId": "company-uuid-บริษัทผู้รับซ่อม",
    "billNo": "DOC-OUT-2026/09",
    "mechanicIds": ["user-uuid-ช่างผู้ประสานงาน"]
  }
  ```
- **Response (200 OK):**
  - ส่ง Object `RepairJob` พร้อม Array `repairJobSteps` ครบทุก Step
  - สังเกตว่า `repairJobSteps[0..3]` จะมี `completeAt` และ `completedBy` เติมมาให้แล้วทันที

---

### 3.4 ช่วงที่ 3: อัปเดตความคืบหน้ารายขั้นตอน (Update Step Progress)
> 📌 **Frontend Note:** สำหรับให้ช่าง/พัสดุ/ผู้อนุมัติ กดผ่านขั้นตอนทีละ Step (ตั้งแต่ Step 5 เป็นต้นไป)

```http
PATCH /repairs/:id/steps/:stepNumber
```
- **URL Parameters:**
  - `id`: Job UUID
  - `stepNumber`: ลำดับของ Step เช่น `5`, `6`, `7`
- **Request Body:**
  ```json
  {
    "note": "ผ่านการอนุมัติเรียบร้อย อยู่ระหว่างรอเอกสาร",
    "completeAt": "2026-09-02T10:30:00.000Z" // Optional: ถ้าไม่ส่ง Backend ใช้วันเวลาปัจจุบัน
  }
  ```
- **Behavior & State Transition ใน Backend:**
  - ถ้าอัปเดต **Step 5 (OUTSOURCE)** ➔ `JobStatus` เปลี่ยนเป็น **`OUTSOURCED`** 🚚
  - ถ้าอัปเดต **Step 5 (EXTERNAL_STOCK)** ➔ `JobStatus` เปลี่ยนเป็น **`WAITING_PARTS`** ⏳
  - ถ้าอัปเดต **Step จ่าย/รับของ** ➔ `JobStatus` เปลี่ยนเป็น **`IN_PROGRESS`** 🔧
  - ถ้าอัปเดต **Step ก่อนสุดท้าย (แล้วเสร็จ)** ➔ `JobStatus` เปลี่ยนเป็น **`WAITING_DELIVERY`** 🔔
  - ถ้าอัปเดต **Step สุดท้าย (ตรวจรับงาน)** ➔ `JobStatus` เปลี่ยนเป็น **`COMPLETED`** ✅ และคืนสถานะ Asset เป็น **`NORMAL` / `AVAILABLE`**

---

### 3.5 ดึงรายการงานซ่อม (List with Filters & Pagination)
```http
GET /repairs?statusCode=IN_PROGRESS&page=1&limit=10
```
- **Query Parameters ที่รองรับ:**
  - `page` (number): หน้าที่ต้องการ (Default: 1)
  - `limit` (number): จำนวนต่อหน้า (Default: 10)
  - `statusCode` (string): ฟิลเตอร์สถานะ เช่น `PENDING_ASSIGN`, `IN_PROGRESS`, `WAITING_PARTS`, `OUTSOURCED`, `WAITING_DELIVERY`, `COMPLETED`
  - `stepActionType` (string): `SELF_REPAIR`, `INTERNAL_STOCK`, `EXTERNAL_STOCK`, `OUTSOURCE`, `PURCHASE_REPLACEMENT`
  - `urgencyStatus` (string): `NORMAL`, `URGENT`, `EMERGENCY`
  - `reportType` (string): `Repair`, `Maintenance`
  - `sectionId` (uuid): ฟิลเตอร์ตามแผนก
  - `assetId` (uuid): ฟิลเตอร์ตามครุภัณฑ์
  - `mechanicId` (uuid): ฟิลเตอร์ตามช่างที่รับผิดชอบ

---

### 3.6 ดึงรายละเอียดงานซ่อมรายใบ (Get Single Job Detail)
```http
GET /repairs/:id
```
- **Response Structure สำคัญ:**
  ```json
  {
    "id": "job-uuid",
    "jobNo": "REP-202609-0001",
    "symptom": "...",
    "diagnosis": "...",
    "solution": "...",
    "dueDate": "2026-09-10T17:00:00.000Z",
    "returnDate": null,
    "jobStatus": { "code": "IN_PROGRESS", "name": "ช่างกำลังดำเนินการซ่อม" },
    "asset": { "id": "...", "asset_code": "AST-001", "name": "...", "status": { ... } },
    "mechanicRepairs": [{ "user": { "id": "...", "firstname": "...", "lastname": "..." } }],
    "repairJobSteps": [
      {
        "id": 101,
        "completeAt": "2026-09-01T08:00:00.000Z",
        "note": null,
        "stepMaster": { "stepNumber": 1, "label": "วันแจ้งซ่อม", "actionType": "INTERNAL_STOCK" },
        "user": { "firstname": "สมชาย", "lastname": "ใจดี" }
      }
    ],
    "sparepartTxns": [
      {
        "txnId": 1,
        "txnType": "WITHDRAW",
        "qty": 1,
        "unitPrice": "150.00",
        "sparepart": { "name": "ฟิวส์ 10A", "code": "SP-001" }
      }
    ]
  }
  ```

---

### 3.7 ส่งมอบคืน บันทึกประกัน และปิด Job โดยตรง (Complete Job)
```http
PATCH /repairs/:id/complete
```
- **Request Body:**
  ```json
  {
    "warrantyDate": "2027-09-01",
    "receiverId": "user-uuid-ผู้รับมอบเครื่องคืน",
    "note": "ทดสอบระบบพร้อมใช้งาน ส่งมอบคืนแผนกเรียบร้อย"
  }
  ```
- **ผลลัพธ์:** ปรับ `JobStatus: COMPLETED`, `AssetStatus: NORMAL`, `AvailabilityStatus: AVAILABLE`

---

### 3.8 การคืนอะไหล่ส่วนเกินเข้าคลัง (Return Spare Parts)
```http
POST /repairs/:id/spare-parts/return
```
- **Request Body:**
  ```json
  {
    "sparepartId": 1,
    "qty": 1,
    "note": "เบิกมา 2 ชิ้น ใช้จริง 1 ชิ้น คืนเข้าคลัง 1 ชิ้น"
  }
  ```
- **ผลลัพธ์:** คืนยอดสต็อกเข้า `SPAREPART.qty_in_stock` และบันทึก `SPAREPART_TXN` ประเภท `RETURN`

---

## 💡 Frontend Best Practices & UI Tips

1. **Stepper / Timeline Rendering:**
   - ใช้ `job.repairJobSteps` ในการ Render Stepper
   - ถ้า `step.completeAt !== null` ให้แสดงไอคอน ✅ ผ่านแล้ว พร้อมแสดงวันที่และชื่อผู้ดำเนินการ (`step.user.firstname`)
   - ขั้นตอนที่กำลังดำเนินการ (Active Step) คือ Step แรกที่ `completeAt === null`
2. **Form Validation:**
   - ถ้าเลือก `stepActionType === 'OUTSOURCE'` อย่าลืมบังคับให้เลือก `companyId` ในฟอร์ม
   - ถ้าเลือก `stepActionType === 'INTERNAL_STOCK'` สามารถตรวจสอบสต็อกคงเหลือจาก Master อะไหล่ก่อนกดส่งได้
3. **Tab Filtering:**
   - ออกแบบ Tab บนหน้าตารางงานซ่อมตาม `statusCode`:
     - 📥 ทั้งหมด
     - ⏳ รอมอบหมาย (`PENDING_ASSIGN`)
     - 🔧 กำลังซ่อม (`IN_PROGRESS`)
     - 📦 รออะไหล่/พัสดุ (`WAITING_PARTS`, `PARCEL_PROCESSING`)
     - 🚚 ส่งซ่อมนอก (`OUTSOURCED`)
     - 🔔 รอส่งมอบ (`WAITING_DELIVERY`)
     - ✅ เสร็จสมบูรณ์ (`COMPLETED`)
