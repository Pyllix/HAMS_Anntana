# รายการสำรวจ API Filter และระดับผลกระทบ (API Filter Design Audit & Backlog)

> บันทึกข้อมูลเมื่อ: 2026-09-02  
> สถานะ: รอดำเนินการพิจารณาปรับปรุงหลังเสร็จสิ้นฟีเจอร์ระบบงานแจ้งซ่อม (Repairs Module)

---

## 1. ตารางสรุปผลการสำรวจและระดับผลกระทบ

| ลำดับ | โมดูล / Endpoint | ปัญหาที่พบในการออกแบบ Filter | ระดับผลกระทบ | สถานะ |
| :---: | :--- | :--- | :---: | :---: |
| 1 | **`GET /asset`** | **ขาด Filter สำคัญใน `AssetFilterDto`**<br>มีแค่ `section_id` แต่ไม่มี `asset_status_id`, `availability_status_id`, `asset_type_id`, `equipment_type_id` | 🔴 **สูง (High)** | ✅ **เสร็จสิ้น** |
| 2 | **`GET /asset/section/:sectionId`** | **สร้าง Path ซ้ำซ้อนกับการทำ Query Filter**<br>มีทั้ง `GET /asset?section_id=...` และ `GET /asset/section/:id` ทำให้เกิด Code Duplication และผสม Filter ไม่ได้ | 🟡 **ปานกลาง (Medium)** | รอดำเนินการ |
| 3 | **`GET /borrowings`** | **ขาด Filter ด้านหน่วยงานและช่วงเวลา** ใน `BorrowFilterDto`<br>มีแค่ `assetId`, `borrowerId`, `borrowStatusId` แต่ไม่มี `sectionId` หรือ `startDate`/`endDate` | 🟡 **ปานกลาง (Medium)** | ✅ **เสร็จสิ้น** |
| 4 | **`GET /users`** | **ขาด Filter ด้านแผนก** ใน `QueryUserDto`<br>มีแค่ `role`, `search` แต่ไม่มี `section_id` สำหรับ Dropdown แยกรายแผนก | 🟡 **ปานกลาง (Medium)** | ✅ **เสร็จสิ้น** |
| 5 | **`GET /spare-parts/transactions`** | **ขาด Filter ด้านช่วงเวลาและผู้ทำรายการ** ใน `QuerySparepartTxnDto`<br>มีแค่ `sparepartId`, `jobId`, `txnType` แต่ไม่มี `startDate`, `endDate`, `userId` | 🟡 **ปานกลาง (Medium)** | ✅ **เสร็จสิ้น** |
| 6 | **`GET /company`, `GET /sections`** | **ไม่มี Search และ Pagination**<br>ดึงข้อมูลทั้งหมดออกมาแบบ Flat Array (ปัจจุบันยังไม่ส่งผลมากเพราะข้อมูลหลักสิบถึงร้อยรายการ) | 🟢 **ต่ำ (Low)** | รอดำเนินการ |

---

## 2. รายละเอียดเชิงลึกและแนวทางการแก้ไข

### 🔴 1. โมดูล Assets (`GET /asset`)
* **สถานะ:** ✅ ปรับปรุงเรียบร้อยแล้ว รองรับ `section_id`, `asset_status_id`, `availability_status_id`, `asset_type_id`, `equipment_type_id`, `search`, `page`, `limit`

---

### 🟡 2. เส้นทางซ้ำซ้อนใน Assets (`GET /asset/section/:sectionId`)
* **ปัญหาปัจจุบัน:**
  * มีทั้ง `GET /asset?section_id=xxx` และ `GET /asset/section/:sectionId` และ `GET /asset/my-section`
* **ผลเสีย:**
  * Service มี method `findBySection` และ `findMySectionAssets` แยกกัน เกิด Code Duplication
  * เส้น `findBySection` ไม่สามารถผสม Filter อื่นๆ ร่วมด้วยได้
* **แนวทางแก้ไข:**
  * ยุบรวมให้ใช้ `GET /asset?section_id=xxx` เป็นมาตรฐานเดียว
  * คง `GET /asset/my-section` ไว้เป็น User-centric helper หรือยุบรวมโดยให้ Frontend ส่ง `section_id` ของตนเองเข้ามา

---

### 🟡 3. โมดูล Borrowings (`GET /borrowings`)
* **สถานะ:** ✅ ปรับปรุงเรียบร้อยแล้ว รองรับ `sectionId`, `startDate`, `endDate`, `assetId`, `borrowerId`, `borrowStatusId`, `page`, `limit`

---

### 🟡 4. โมดูล Users (`GET /users`)
* **สถานะ:** ✅ ปรับปรุงเรียบร้อยแล้ว รองรับ `section_id`, `role`, `search`, `page`, `limit`

---

### 🟡 5. โมดูล Spare Parts Transactions (`GET /spare-parts/transactions`)
* **สถานะ:** ✅ ปรับปรุงเรียบร้อยแล้ว รองรับ `startDate`, `endDate`, `userId`, `sparepartId`, `jobId`, `txnType`, `page`, `limit`

---

### 🟢 6. Master Data (`/company`, `/sections`)
* **ปัญหาปัจจุบัน:**
  * คืนค่าเป็น Array ทั้งหมด (`findMany`)
* **แนวทางแก้ไข:**
  * เพิ่ม `PaginationDto` และ Search filter เมื่อปริมาณข้อมูลเริ่มมีขนาดใหญ่

---

## 3. โมดูลที่ออกแบบได้ถูกต้องตาม Best Practice แล้ว (Benchmark)
* **`Repairs Module` (`GET /repairs?...`)**: รวม Filter 10 มิติ (`statusCode`, `urgencyStatus`, `actionType`, `stepActionType`, `mechanicId`, `assetId`, `sectionId`, `startDate`, `endDate`, `search`) ไว้ในเส้นเดียว พร้อม Data Isolation ตาม Role
* **`Spare Parts Module` (`GET /spare-parts?...`)**: รองรับ `sparePartGroupId`, `isLowStock`, `search`, `page`, `limit` ในเส้นเดียวชัดเจน
* **`Spare Parts Transactions` (`GET /spare-parts/transactions?...`)**: รองรับ `sparepartId`, `jobId`, `txnType`, `userId`, `startDate`, `endDate`, `page`, `limit` ครบถ้วน
* **`Users Module` (`GET /users?...`)**: รองรับ `role`, `section_id`, `search`, `page`, `limit` ครบถ้วน
* **`Asset Borrow Module` (`GET /borrowings?...`)**: รองรับ `assetId`, `borrowerId`, `borrowStatusId`, `sectionId`, `startDate`, `endDate`, `page`, `limit` ครบถ้วน
* **`Asset Module` (`GET /asset?...`)**: รองรับ `section_id`, `asset_status_id`, `availability_status_id`, `asset_type_id`, `equipment_type_id`, `search`, `page`, `limit` ครบถ้วน
