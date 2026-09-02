# รายการสำรวจ API Filter และระดับผลกระทบ (API Filter Design Audit & Backlog)

> บันทึกข้อมูลเมื่อ: 2026-09-02  
> สถานะ: รอดำเนินการพิจารณาปรับปรุงหลังเสร็จสิ้นฟีเจอร์ระบบงานแจ้งซ่อม (Repairs Module)

---

## 1. ตารางสรุปผลการสำรวจและระดับผลกระทบ

| ลำดับ | โมดูล / Endpoint | ปัญหาที่พบในการออกแบบ Filter | ระดับผลกระทบ | สถานะ |
| :---: | :--- | :--- | :---: | :---: |
| 1 | **`GET /asset`** | **ขาด Filter สำคัญใน `AssetFilterDto`**<br>มีแค่ `section_id` แต่ไม่มี `asset_status_id`, `availability_status_id`, `asset_type_id` | 🔴 **สูง (High)** | ✅ **เสร็จสิ้น** |
| 2 | **`GET /asset/section/:sectionId`** | **สร้าง Path ซ้ำซ้อนกับการทำ Query Filter**<br>มีทั้ง `GET /asset?section_id=...` และ `GET /asset/section/:id` ทำให้เกิด Code Duplication และผสม Filter ไม่ได้ | 🟡 **ปานกลาง (Medium)** | รอดำเนินการ |
| 3 | **`GET /borrowings`** | **ขาด Filter ด้านหน่วยงานและช่วงเวลา** ใน `BorrowFilterDto`<br>มีแค่ `assetId`, `borrowerId`, `borrowStatusId` แต่ไม่มี `sectionId` หรือ `startDate`/`endDate` | 🟡 **ปานกลาง (Medium)** | ✅ **เสร็จสิ้น** |
| 4 | **`GET /company`, `GET /sections`** | **ไม่มี Search และ Pagination**<br>ดึงข้อมูลทั้งหมดออกมาแบบ Flat Array (ปัจจุบันยังไม่ส่งผลมากเพราะข้อมูลหลักสิบถึงร้อยรายการ) | 🟢 **ต่ำ (Low)** | รอดำเนินการ |

---

## 2. รายละเอียดเชิงลึกและแนวทางการแก้ไข

### 🔴 1. โมดูล Assets (`GET /asset`)
* **ปัญหาปัจจุบัน:**
  * ใน `src/asset/dto/asset-filter.dto.ts` มีเฉพาะ `section_id?: string`
  * หน้าบ้านไม่สามารถกรองดูตามสถานะความพร้อม (เช่น `AVAILABLE` เพื่อนำไปยืม) หรือตามประเภทครุภัณฑ์ได้
* **ผลเสีย:**
  * หากหน้าบ้านดึงข้อมูลทั้งหมดมา Filter ใน Client-side จะทำให้ระบบ Pagination เพี้ยน (Broken Pagination) และช้าเมื่อข้อมูลมีจำนวนมาก
* **แนวทางแก้ไข:**
  * ขยาย `AssetFilterDto` ให้รองรับ:
    ```typescript
    export class AssetFilterDto extends PaginationDto {
      section_id?: string;
      asset_status_id?: number;
      availability_status_id?: number;
      asset_type_id?: number;
    }
    ```
  * อัปเดต Prisma `where` clause ใน `src/asset/asset.service.ts`

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
* **ปัญหาปัจจุบัน:**
  * ใน `src/asset-borrow/dto/borrow-filter.dto.ts` ยังขาด `sectionId`, `startDate`, `endDate`
* **ผลเสีย:**
  * เจ้าหน้าที่ศูนย์เครื่องมือไม่สามารถคัดกรองประวัติการยืมตาม "แผนกที่ยืม" หรือ "รอบประจำเดือน/ปีงบประมาณ" ได้
* **แนวทางแก้ไข:**
  * เพิ่มฟิลด์ `sectionId?: string`, `startDate?: string`, `endDate?: string` ลงใน `BorrowFilterDto` และ Query ใน `AssetBorrowService`

---

### 🟢 4. Master Data (`/company`, `/sections`)
* **ปัญหาปัจจุบัน:**
  * คืนค่าเป็น Array ทั้งหมด (`findMany`)
* **แนวทางแก้ไข:**
  * เพิ่ม `PaginationDto` และ Search filter เมื่อปริมาณข้อมูลเริ่มมีขนาดใหญ่

---

## 3. โมดูลที่ออกแบบได้ถูกต้องตาม Best Practice แล้ว (Benchmark)
* **`Repairs Module` (`GET /repairs?...`)**: รวม Filter 10 มิติ (`statusCode`, `urgencyStatus`, `actionType`, `stepActionType`, `mechanicId`, `assetId`, `sectionId`, `search`) ไว้ในเส้นเดียว พร้อม Data Isolation ตาม Role
* **`Spare Parts Module` (`GET /spare-parts?...`)**: รองรับ `sparePartGroupId`, `isLowStock`, `search`, `page`, `limit` ในเส้นเดียวชัดเจน
* **`Users Module` (`GET /users?...`)**: รองรับ `role`, `search`, `page`, `limit` ครบถ้วน
