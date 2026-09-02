# 📘 Frontend Developer Guide: Maintenance & Repair Module API

คู่มือการเชื่อมต่อ API โมดูลงานซ่อมบำรุงและจัดการสถานะ (Maintenance & Repair Job API) สำหรับ Frontend Developer

---

## 🧭 1. ภาพรวมสถาปัตยกรรม & ลำดับการทำงาน (Frontend Workflow Lifecycle)

ระบบแบ่งออกเป็น **3 ช่วงเวลาหลัก** ตามการใช้งานจริง:

```
[ช่วงที่ 1: แจ้งซ่อม] ────────▶ [ช่วงที่ 2: ฟอร์มช่างรับงาน & วินิจฉัย & วางแผน] ────────▶ [ช่วงที่ 3: ทยอยกดอัปเดตตามจริง]
  • หน่วยงานแจ้งซ่อม                • ธุรการ/ช่างกรอกฟอร์มเดียว รวดเดียว (Steps 2-4)          • ผู้อนุมัติ / พัสดุ / ช่าง
  • POST /repairs                   • PATCH /repairs/:id/diagnose                              • PATCH /repairs/:id/steps/:stepNumber
  • Auto-complete Step 1            • Auto-complete Steps 1-4 ทันที                            • ทยอยกดตาม Event หน้างานจริง
```

---

## 🛡️ 2. กฎการควบคุมสิทธิ์รายขั้นตอน & การแสดงผลปุ่มบนหน้าเว็บ (Strict Role Enforcement)

> ⚠️ **กฎเหล็กเรื่องสิทธิ์ (Strict Separation of Duties):**
> 1. `ADMIN` จะ **ไม่มีบทบาทในขั้นตอนปฏิบัติการงานซ่อม (Operational Workflow)** เพื่อความโปร่งใสและถูกต้องตามระเบียบโรงพยาบาล โดย `ADMIN` จะมีสิทธิ์เฉพาะการดูข้อมูล (Read-only / Audit) เท่านั้น
> 2. หน้า Frontend จะ **ไม่แสดงปุ่ม Action ใดๆ ให้ผู้ใช้ที่มี Role เป็น `ADMIN`** ในขั้นตอนปฏิบัติการ

| ขั้นตอน (Step Description) | ผู้มีสิทธิ์กดในระบบ (Designated Roles) | สิทธิ์ของ `ADMIN` | คำแนะนำการแสดงผลบน UI สำหรับ Frontend |
|---|:---:|:---:|---|
| **Step 1: แจ้งซ่อม** | ทุก Role (`DEPARTMENT_STAFF`, `MAINTENANCE_STAFF` ฯลฯ) | ✅ ทำได้ (แจ้งเครื่องตนเอง) | แสดงปุ่มแจ้งซ่อมให้ทุกคน |
| **Step 2-4: รับงาน, วินิจฉัย, วางแผนเคส** | `MAINTENANCE_STAFF` | ❌ **ไม่มีสิทธิ์ (Forbidden)** | แสดงฟอร์มและปุ่มบันทึกเฉพาะช่าง (`MAINTENANCE_STAFF`) เท่านั้น |
| **Step 5: อนุมัติจัดหา / อนุมัติส่งซ่อม (Stock / Outsource)** | **`PARCEL_STAFF`** | ❌ **ไม่มีสิทธิ์ (Forbidden)** | `ADMIN`, `MAINTENANCE_STAFF`, `MANAGER` ➔ **Disable / Hide Button** |
| **Step 5: พัสดุตรวจสอบขอซื้อทดแทน (Replacement)** | **`PARCEL_STAFF`** | ❌ **ไม่มีสิทธิ์ (Forbidden)** | Role อื่นๆ ➔ **Disable / Hide Button** |
| **Step 6: ผู้บริหารอนุมัติขอซื้อทดแทน (Replacement)** | **`MANAGER`** | ❌ **ไม่มีสิทธิ์ (Forbidden)** | Role อื่นๆ ➔ **Disable / Hide Button** |
| **พัสดุจ่ายอะไหล่ / รับของเข้าคลัง (Step 6 ใน Stock หรือ Step 7 ใน Replacement)** | **`PARCEL_STAFF`** | ❌ **ไม่มีสิทธิ์ (Forbidden)** | `ADMIN`, `MAINTENANCE_STAFF` ➔ **Disable / Hide Button** |
| **ช่างรับอะไหล่ / ดำเนินการซ่อม / ตั้งค่าเครื่อง** | `MAINTENANCE_STAFF` | ❌ **ไม่มีสิทธิ์ (Forbidden)** | `ADMIN`, `PARCEL_STAFF` ➔ **Disable / Hide Button** |
| **ตรวจรับงานและปิด Job (Step สุดท้าย - ส่งมอบคืน)** | `MAINTENANCE_STAFF` | ❌ **ไม่มีสิทธิ์ (Forbidden)** | **แสดงฟอร์มให้ช่างเลือก Dropdown เจ้าหน้าที่ผู้มารับมอบ (`receiverId`) และระบุ `warrantyDate`** |

---

## 🏷️ 3. ชุดสถานะงานซ่อม (`jobStatus.code`) สำหรับทำ Badge / Tab Filter

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

## 🛠️ 4. API Endpoints Reference

### 4.1 ดึงข้อมูล Master / Lookup สำหรับ Dropdown ในฟอร์ม
```http
GET /repairs/lookups/meta
```
- **Authentication:** `Bearer Token` (ทุก Role)

---

### 4.2 ช่วงที่ 1: สร้างใบแจ้งซ่อมออนไลน์ (Create Repair Request)
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
    "reportType": "Repair"
  }
  ```

---

### 4.3 ช่วงที่ 2: ฟอร์มรับงาน & วินิจฉัย & วางแผนเคส (Diagnose & Plan) — **Single Submit**
```http
PATCH /repairs/:id/diagnose
```
- **สิทธิ์การใช้งาน:** `MAINTENANCE_STAFF`, `ADMIN`
- **Request Body (ตัวอย่างเคส PURCHASE_REPLACEMENT):**
  ```json
  {
    "diagnosis": "ตัวถังแตกหัก แผงวงจรหลักเสียหายสิ้นเชิง ซ่อมไม่คุ้มค่า",
    "solution": "แทงชำรุดและขอจัดซื้อเครื่องใหม่ทดแทน",
    "causeId": 2,
    "techCategoryId": 1,
    "jobTypeId": 2,
    "actionType": "REPAIR",
    "stepActionType": "PURCHASE_REPLACEMENT",
    "mechanicIds": ["user-uuid-ช่างผู้ประเมิน"]
  }
  ```

---

### 4.4 ช่วงที่ 3: อัปเดตความคืบหน้ารายขั้นตอน (Update Step Progress)
```http
PATCH /repairs/:id/steps/:stepNumber
```
- **URL Parameters:**
  - `id`: Job UUID
  - `stepNumber`: ลำดับของ Step เช่น `5`, `6`, `7` ... หรือ Step สุดท้าย
- **Request Body (Step ทั่วไป):**
  ```json
  {
    "note": "ผ่านการตรวจสอบความถูกต้อง",
    "completeAt": "2026-09-02T10:30:00.000Z"
  }
  ```
- **Request Body (Step สุดท้าย - ช่างกดส่งมอบคืน & ปิด Job):**
  ```json
  {
    "receiverId": "user-uuid-เจ้าหน้าที่หน่วยงานผู้มารับมอบเครื่อง",
    "warrantyDate": "2027-09-01",
    "note": "ทดสอบเครื่องพร้อมใช้งาน ส่งมอบคืนหน่วยงานเรียบร้อย"
  }
  ```
  *(เมื่อบันทึก Step สุดท้าย ระบบจะเปลี่ยนสถานะเป็น `COMPLETED` และปรับสถานะ Asset เป็น `NORMAL`/`AVAILABLE` หรือ `WAIT_DISPOSAL` ให้อัตโนมัติทันที)*

---

### 4.5 ดึงรายการงานซ่อม & รายละเอียด
- `GET /repairs?statusCode=PARCEL_PROCESSING&page=1&limit=10`
- `GET /repairs/:id`
- `POST /repairs/:id/spare-parts/return`
- `PATCH /repairs/:id/complete` (หรือใช้ Step สุดท้ายใน `PATCH /repairs/:id/steps/:stepNumber`)
