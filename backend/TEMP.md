# HAMS Asset Borrowing API Documentation (สำหรับ Frontend)

เอกสารฉบับนี้ใช้สำหรับให้นักพัฒนา Frontend นำไปใช้อ่านและเข้าใจกระบวนการทำงานรวมถึงการเรียกใช้ API ในการจัดการยืม-คืนครุภัณฑ์ (Asset Borrowing Flow)

---

## 🔄 State Machine & Workflow (ขั้นตอนสถานะ)

กระบวนการยืม-คืนมี 2 รูปแบบหลัก:

### 1. การยืมผ่านแอปโดยผู้ใช้ทั่วไป (Self-Service Flow)
```
[ผู้ยืม] ยื่นคำขอยืม          [AC Staff] กดอนุมัติ          [AC Staff] ส่งมอบของจริง       [ผู้ยืม/Staff] ส่งคืน
PENDING_APPROVAL   ───────►      APPROVED      ───────►      BORROWED      ───────►      RETURNED
(Asset: RESERVED)             (Asset: RESERVED)             (Asset: BORROWED)             (Asset: AVAILABLE)
```

* **การยกเลิกคำขอ (`cancelBorrow`)**:
  * เมื่ออยู่สถานะ `PENDING_APPROVAL`: ผู้ยืม หรือเพื่อนร่วมแผนกเดียวกัน หรือเจ้าหน้าที่ศูนย์ฯ สามารถยกเลิกได้
  * เมื่ออยู่สถานะ `APPROVED`: เฉพาะเจ้าหน้าที่ศูนย์ฯ (Asset Center) เท่านั้นที่จะยกเลิกได้ (กรณีอนุมัติผิดพลาด)
  * เมื่ออยู่สถานะ `BORROWED`: **ไม่สามารถยกเลิกได้** ต้องทำกระบวนการคืน (`returnAsset`) เท่านั้น

### 2. การทำเรื่องยืมโดยตรงที่ศูนย์ครุภัณฑ์ (Center-Service Flow)
กรณีผู้ยืมมาติดต่อที่ศูนย์ และเจ้าหน้าที่ทำให้ตรงนั้น:
```
[AC Staff] ทำเรื่องยืมแทน 
      BORROWED (ข้ามขั้นตอนอนุมัติ) ➔ บันทึก approved_at และ handover_date ทันที
```

---

## 📡 API Endpoints

ทุก Endpoint จำเป็นต้องแนบ **Bearer Token** ใน Header (`Authorization: Bearer <token>`)

---

### 1. ยื่นคำขอยืมครุภัณฑ์ (Create Borrow Request)
* **Endpoint:** `POST /borrowings`
* **สิทธิ์ผู้ใช้งาน (Roles):** `DEPARTMENT_STAFF`, `PARCEL_STAFF`, `ASSET_CENTER_STAFF`
* **Request Body:**
  ```json
  {
    "assetId": "uuid-ของครุภัณฑ์",
    "deliveryMethod": "PICKUP", // หรือ "DELIVERY"
    "borrowerId": "uuid-ของผู้ยืม" // ส่งเฉพาะเมื่อ ASSET_CENTER_STAFF ทำเรื่องแทนผู้อื่น
  }
  ```
* **รายละเอียดการทำงาน:**
  * หากเรียกโดยผู้ยืมทั่วไป ระบบจะตั้ง `borrower_id` เป็นไอดีผู้ใช้คนนั้นโดยอัตโนมัติ (และข้าม `borrowerId` ที่ส่งมา)
  * สถานะจะเริ่มต้นเป็น `PENDING_APPROVAL` (กรณี Self-Service) หรือ `BORROWED` (กรณี Center-Service)

---

### 2. อนุมัติคำขอยืม (Approve Request)
* **Endpoint:** `PATCH /borrowings/:id/approve`
* **สิทธิ์ผู้ใช้งาน (Roles):** `ASSET_CENTER_STAFF` (เจ้าหน้าที่ศูนย์)
* **รายละเอียดการทำงาน:**
  - อัปเดตสถานะจาก `PENDING_APPROVAL` เป็น `APPROVED`
  - บันทึกเวลาอนุมัติลงฟิลด์ `approved_at`
  - ตัวครุภัณฑ์ (Asset) จะคงสถานะ `RESERVED` (จองไว้ ยังไม่ส่งมอบ)

---

### 3. ส่งมอบครุภัณฑ์จริง (Handover / Dispatch Asset)
* **Endpoint:** `PATCH /borrowings/:id/handover`
* **สิทธิ์ผู้ใช้งาน (Roles):** `ASSET_CENTER_STAFF`, `ADMIN`, `MANAGER`
* **รายละเอียดการทำงาน:**
  - อัปเดตสถานะจาก `APPROVED` เป็น `BORROWED`
  - บันทึกเวลาส่งมอบลงฟิลด์ `handover_date` (ถือเป็นจุดเริ่มต้นเวลาการยืม)
  - ปรับสถานะครุภัณฑ์จริง (Asset) จาก `RESERVED` เป็น `BORROWED`

---

### 4. ปฏิเสธคำขอยืม (Reject Request)
* **Endpoint:** `PATCH /borrowings/:id/reject`
* **สิทธิ์ผู้ใช้งาน (Roles):** `ASSET_CENTER_STAFF`
* **Request Body:**
  ```json
  {
    "reason": "เหตุผลที่ไม่อนุมัติการยืม เช่น ครุภัณฑ์ต้องนำไปบำรุงรักษาด่วน"
  }
  ```
* **รายละเอียดการทำงาน:**
  - เปลี่ยนสถานะจาก `PENDING_APPROVAL` เป็น `REJECTED`
  - คืนค่าสถานะตัวครุภัณฑ์จาก `RESERVED` กลับเป็น `AVAILABLE` (ว่างพร้อมใช้งาน)
  - บันทึกวันเวลาปฏิเสธในฟิลด์ `rejected_at`

---

### 5. คืนครุภัณฑ์ (Return Asset)
* **Endpoint:** `PATCH /borrowings/:id/return`
* **สิทธิ์ผู้ใช้งาน (Roles):** `ASSET_CENTER_STAFF`, `PARCEL_STAFF`, `DEPARTMENT_STAFF`
* **Request Body:**
  ```json
  {
    "returnCondition": "Normal", // หรือ "Damage"
    "returnMethod": "self_return", // หรือ "staff_pickup"
    "returnRemark": "หมายเหตุเพิ่มเติม (ถ้ามี)",
    "returnedByUserId": "uuid-หรือ-รหัสพนักงาน" // ส่งเฉพาะเมื่อเจ้าหน้าที่ศูนย์กดรับคืนและประสงค์ระบุตัวคนคืน
  }
  ```
* **รายละเอียดการทำงาน:**
  - เปลี่ยนสถานะคำขอเป็น `RETURNED` และบันทึก `return_date`
  - **หากสภาพเครื่องปกติ (`Normal`):** คืนสถานะครุภัณฑ์เป็น `AVAILABLE`
  - **หากสภาพเครื่องชำรุด (`Damage`):** เปลี่ยนสภาพครุภัณฑ์เป็น `DAMAGED` และตั้งค่า AvailabilityStatus เป็น `UNAVAILABLE`

---

### 6. ยกเลิกรายการยืม (Cancel Request)
* **Endpoint:** `PATCH /borrowings/:id/cancel`
* **สิทธิ์ผู้ใช้งาน (Roles):** `DEPARTMENT_STAFF`, `PARCEL_STAFF`, `ASSET_CENTER_STAFF`
* **Request Body:**
  ```json
  {
    "cancelReason": "เหตุผลที่ขอยกเลิกรายการ (ส่งมาหรือไม่ส่งก็ได้)"
  }
  ```
* **รายละเอียดการทำงาน:**
  - เปลี่ยนสถานะคำขอเป็น `CANCELLED` บันทึก `cancelled_at` และ `cancel_reason`
  - คืนสถานะตัวครุภัณฑ์จาก `RESERVED` กลับเป็น `AVAILABLE`
  - **ข้อจำกัด:** 
    - `DEPARTMENT_STAFF` ยกเลิกได้เฉพาะตอนสถานะ `PENDING_APPROVAL` เท่านั้น
    - เจ้าหน้าที่ศูนย์ฯ ยกเลิกได้ทั้งตอน `PENDING_APPROVAL` และ `APPROVED`
    - ทุก Role ห้ามยกเลิกเมื่อเข้าสู่สถานะ `BORROWED`

---

### 7. ดึงรายการประวัติการยืม (List Borrowings)
* **Endpoint:** `GET /borrowings`
* **Query Parameters (ตัวกรอง):**
  - `page` (number): หน้าที่ต้องการดึง
  - `limit` (number): จำนวนรายการต่อหน้า
  - `assetId` (string)
  - `borrowerId` (string)
  - `borrowStatusId` (number)
* **สิทธิ์การมองเห็น (Scope):**
  - หากเข้าใช้งานด้วยสิทธิ์ `DEPARTMENT_STAFF` ระบบจะกรองให้เห็นเฉพาะรายการที่เป็นของ **แผนกเดียวกันกับตนเอง** โดยอัตโนมัติเพื่อป้องกันข้อมูลแผนกอื่นรั่วไหล

---

---

### 8. ดึงรายละเอียดของรายการยืมแบบเจาะจง (Get Borrowing Details)
* **Endpoint:** `GET /borrowings/:id`
* **รายละเอียดการทำงาน:**
  - ส่งรายละเอียดเชิงลึกของคำขอนั้นๆ รวมถึงวันเวลาสำคัญ (`createdAt`, `approved_at`, `handover_date`, `return_date`, `cancelled_at`, `rejected_at`)
  - คุ้มครองความปลอดภัย หากเป็น `DEPARTMENT_STAFF` จะดึงข้อมูลได้เฉพาะคำขอที่อยู่ในแผนกเดียวกันเท่านั้น (ถ้าเรียกข้ามแผนกจะได้ `403 Forbidden`)

---

## 📋 ฟิลด์ข้อมูลที่เพิ่มขึ้นมาใหม่ (New Database Fields)

ในตารางประวัติการยืม-คืน (`BorrowTransaction`) มีการเพิ่มฟิลด์เหล่านี้ขึ้นมาจากระบบเดิม เพื่อใช้ในการบันทึกเวลาทำรายการ (Audit timestamps) และบันทึกเหตุผลยกเลิก:

| ฟิลด์ใหม่ (API property) | ประเภทข้อมูล | ความหมาย / การบันทึกค่า |
|---|---|---|
| **`approved_at`** | `DateTime?` | บันทึกเวลาที่เจ้าหน้าที่กดอนุมัติคำขอ (เปลี่ยนสถานะเป็น `APPROVED`) |
| **`handover_date`** | `DateTime?` | บันทึกเวลาที่ส่งมอบครุภัณฑ์จริงให้กับผู้ยืม (เปลี่ยนสถานะเป็น `BORROWED`) |
| **`cancelled_at`** | `DateTime?` | บันทึกเวลาที่ทำการยกเลิกคำขอสำเร็จ (เปลี่ยนสถานะเป็น `CANCELLED`) |
| **`rejected_at`** | `DateTime?` | บันทึกเวลาที่เจ้าหน้าที่กดปฏิเสธคำขอ (เปลี่ยนสถานะเป็น `REJECTED`) |
| **`cancel_reason`** | `String?` | เก็บข้อความระบุเหตุผลในการกดยกเลิกรายการ |

*หมายเหตุ: ฟิลด์ทั้งหมดด้านบนเป็นประเภท **Nullable** (สามารถส่งค่าคืนกลับมาเป็น `null` ได้ หากคำขอยังไม่ดำเนินมาถึงขั้นตอนนั้นๆ เช่น หากคำขอเพิ่งสร้าง จะมีเพียง `createdAt` ส่วนฟิลด์ที่เหลือจะเป็น `null` ทั้งหมด)*

---

## 🔒 การจองสถานะครุภัณฑ์ (`RESERVED`)

เพื่อป้องกันไม่ให้ผู้ใช้คนอื่นเข้ามากดยืมครุภัณฑ์ชิ้นเดียวกันซ้ำซ้อนในระหว่างที่คำขอยังคงค้างอยู่ในระบบ:

1. **เมื่อยื่นคำขอยืมสำเร็จ (`PENDING_APPROVAL`)**:
   - ระบบจะสลับ AvailabilityStatus ของตัวครุภัณฑ์ (Asset) ตัวนั้นจาก **`AVAILABLE`** (ว่างพร้อมใช้งาน) ➔ **`RESERVED`** (ถูกจอง/รออนุมัติ) โดยทันที
2. **เมื่อคำขอได้รับการอนุมัติ (`APPROVED`)**:
   - ตัวครุภัณฑ์จะยังคงล็อกอยู่ที่สถานะ **`RESERVED`** ต่อไป เพื่อรอขั้นตอนการมาส่งมอบหรือมารับของจริง
3. **เมื่อมีการส่งมอบของจริงสำเร็จ (`BORROWED`)**:
   - สถานะ AvailabilityStatus ของครุภัณฑ์จะเปลี่ยนเป็น **`BORROWED`** (ถูกยืม)
4. **กรณีคำขอถูกยกเลิก หรือถูกปฏิเสธ (`CANCELLED` / `REJECTED`)**:
   - ตัวครุภัณฑ์จะคลายการจอง และสลับจาก **`RESERVED`** ➔ กลับมาเป็น **`AVAILABLE`** (ว่างพร้อมใช้งาน) ทันที เพื่อให้ผู้ใช้อื่นสามารถกดยืมต่อได้

* **Frontend Best Practice:** บน UI ของการแสดงรายการครุภัณฑ์ หากตัวเครื่องมีสถานะเป็น `RESERVED` ควรปิดปุ่มกดขอยืม (Disable) และแสดงป้ายสถานะ เช่น **"ถูกจอง / รอส่งมอบ"** เพื่อป้องกันผู้ใช้ส่งคำขอซ้ำซ้อนเข้ามา

---

### 9. การดึงข้อมูลรายการยืม (Transaction) จากข้อมูลครุภัณฑ์ (Asset)
ในบางกรณีหน้า Frontend อาจมีข้อมูลของตัวครุภัณฑ์ (Asset) อยู่แล้ว และต้องการทราบว่า "ครุภัณฑ์ชิ้นนี้กำลังถูกใครยืมอยู่หรือไม่ หรือมีคำขอที่ค้างรออนุมัติอยู่ไหม"
* **การทำงานฝั่ง Backend:**
  * เมื่อ Frontend เรียกดูข้อมูลครุภัณฑ์ผ่าน `GET /assets` หรือ `GET /assets/:id` ระบบจะทำการดึงข้อมูลรายการยืมล่าสุดที่ยังไม่สิ้นสุดพ่วงมาด้วยในฟิลด์ **`currentBorrowing`** โดยอัตโนมัติ
* **ข้อมูลใน Object ของ Asset (`currentBorrowing`):**
  * หากครุภัณฑ์นั้นว่างอยู่และไม่มีคำขอยืมใดๆ ค้างอยู่:
    `currentBorrowing` จะมีค่าเป็น `null`
  * หากครุภัณฑ์นั้นมีสถานะการยืมเป็น `BORROWED` (กำลังยืม) หรือ `PENDING_APPROVAL` (กำลังรออนุมัติ):
    `currentBorrowing` จะมี Object รายละเอียดการยืมล่าสุดแนบมาด้วย ตัวอย่างรูปแบบข้อมูล:
    ```json
    {
      "id": "uuid-ของ-transaction",
      "borrower_id": "uuid-ของผู้ยืม",
      "borrow_status_id": 21,
      "request_source": "SELF_SERVICE",
      "delivery_method": "PICKUP",
      "createdAt": "2026-08-30T02:00:00Z",
      "borrower": {
        "id": "uuid-ของผู้ยืม",
        "employeeId": "GOV-67005",
        "firstname": "System",
        "lastname": "Dept Staff"
      },
      "borrowStatus": {
        "id": 21,
        "code": "PENDING_APPROVAL",
        "name": "รออนุมัติ"
      }
    }
    ```
* **Frontend Best Practice:** 
  * สำหรับหน้าแสดงรายการครุภัณฑ์ (Asset List) หรือหน้ารายละเอียดครุภัณฑ์ (Asset Detail) สามารถเช็กค่า `asset.currentBorrowing` เพื่อนำข้อมูลผู้ยืมล่าสุดหรือสถานะคำขอยื่นยืมขึ้นมาแสดงผลคู่กับตัวเครื่องได้ทันทีโดยไม่ต้องทำการยิง API แยกไปที่ฝั่ง `/borrowings` อีกรอบ

---

## ⚠️ การจัดการ Error รหัส 409 (Race Condition Protection)
ระบบมีกลไกป้องกันการกดย้ำหรือการกดพร้อมกันจากผู้ใช้หลายคน (เช่น คนนึงกดอนุมัติ อีกคนกดยกเลิกพร้อมกัน)
* หากกระบวนการมีปัญหาเนื่องจากสถานะเปลี่ยนไปก่อนแล้ว ระบบจะตอบกลับด้วยสถานะ **`HTTP 409 Conflict`**
* **Frontend Best Practice:** หากได้รับ HTTP 409 ให้แสดงข้อความแจ้งเตือนผู้ใช้ เช่น *"รายการนี้ได้รับการประมวลผลไปก่อนหน้านี้แล้ว กรุณารีเฟรชหน้าจอเพื่ออัปเดตข้อมูล"* แทนการแจ้งพังทั่วไป
