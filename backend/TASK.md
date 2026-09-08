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
| 7 | **`GET /asset/statistics` (ใหม่)** | **API สรุปผลรวมและแจกแจงตาม Status สำหรับหน้า Dashboard / KPI Boxes**<br>รองรับการนับยอดรวม (Total Assets), ยอดแยกตาม Asset Status (ปกติ, ชำรุด, ส่งซ่อม), และ Availability (พร้อมใช้, ถูกยืม) โดยใช้ `prisma.groupBy()` แทนการวนลูปนับบน Frontend | 🟡 **ปานกลาง (Medium)** | 📋 **รอดำเนินการ** |
| 11 | **`Repairs: MAINTENANCE_HEAD & Workload Balancing`** | **ระบบคัดกรองเบื้องต้น (Triage) และกระจายงานช่างแบบสมดุล**<br>เพิ่ม Role `MAINTENANCE_HEAD`, API มอบหมายงาน (`POST /repairs/:id/assign`), คำนวณภาระงานคงค้าง (`GET /repairs/mechanic-workloads`), และรองรับช่างหลายคนต่อ 1 งานซ่อม | 🔴 **สูง (High)** | 📋 **รอดำเนินการ** |
| 12 | **`Repairs: Unified WITH_PARTS & Mixed Requisition`** | **การเบิกอะไหล่แบบผสม และยุบรวม 4 แทร็กหลัก**<br>ยุบรวม `StepActionType` เป็น `SELF_REPAIR`, `WITH_PARTS`, `OUTSOURCE`, `UNREPAIRABLE` รองรับ `stockType: "INTERNAL" \| "EXTERNAL"` ในใบเดียว พร้อมจัดการสถานะ `WAITING_PARTS` อัตโนมัติ | 🔴 **สูง (High)** | 📋 **รอดำเนินการ** |
| 13 | **`Repairs: Unrepairable Custody Handshake Flow`** | **ระบบส่งมอบเครื่องซ่อมไม่ได้ 2 ขั้นตอน**<br>ช่างประเมินและเลือก `UNREPAIRABLE` ➔ นำส่งพัสดุ ➔ พัสดุกดยืนยันรับมอบ (`complete-unrepairable`) ➔ ปรับสถานะครุภัณฑ์เป็น `WAIT_DISPOSAL` และปิด Job สมบูรณ์ | 🔴 **สูง (High)** | 📋 **รอดำเนินการ** |
| 14 | **`Assets: Direct Asset Disposal Module (/disposals)`** | **ระบบจำหน่ายครุภัณฑ์แบบ Direct Disposal โดยเจ้าหน้าที่พัสดุ**<br>สร้างรายการจำหน่าย (`POST /disposals`) ปรับสถานะเป็น `DISPOSED` ทันที บันทึกประวัติและเอกสารลง `AssetDisposal` พร้อมรองรับ Query Filters และ Pagination | 🔴 **สูง (High)** | 📋 **รอดำเนินการ** |
| 15 | **`Auth: Two-Factor Authentication (2FA via Auth App)`** | **ระบบยืนยันตัวตน 2 ชั้นด้วย Authenticator App (TOTP)**<br>บังคับใช้/เปิดใช้งานสำหรับบทบาทที่มีสิทธิ์สูงและจัดการข้อมูลสำคัญ ได้แก่ `ADMIN`, `PARCEL_STAFF`, `ASSET_CENTER_STAFF` | 🟡 **ปานกลาง (Medium)** | 🔮 **แผนในอนาคต (Phase 2)** |
| 16 | **`Borrow: Smart Asset Recommendation Engine`** | **ระบบแนะนำครุภัณฑ์สำหรับการยืมเพื่อกระจายการใช้งาน**<br>คำนวณจากความถี่และประวัติการยืมในอดีต แนะนำเครื่องที่ถูกยืมน้อยกว่า เพื่อหมุนเวียนการใช้งานอย่างสมดุล ไม่เกิดการยืมกระจุกตัวอยู่เครื่องเดียว | 🟡 **ปานกลาง (Medium)** | 🔮 **แผนในอนาคต (Phase 2)** |
| 17 | **`Repairs: Economic Viability Analysis`** | **การวิเคราะห์ความคุ้มค่าในการซ่อมรายเครื่องสำหรับการซ่อมครั้งต่อไป**<br>ระบบวิเคราะห์และให้คำแนะนำแก่ช่าง/ผู้บริหารในการตัดสินใจซ่อมต่อ หรือแทงชำรุดซื้อทดแทน (*สูตรคำนวณจะกำหนดในรายละเอียดภายหลัง*) | 🟡 **ปานกลาง (Medium)** | 🔮 **แผนในอนาคต (Phase 2)** |
| 18 | **`Assets: Bulk CSV / XLSX Status Sync (e-GP Sync)`** | **ระบบนำเข้าและอัปเดตสถานะครุภัณฑ์แบบกลุ่มจากไฟล์ CSV / XLSX**<br>รองรับการนำเข้าไฟล์ Export จากระบบหลักภาครัฐ (e-GP) เช่น รายการจำหน่าย เพื่อ Batch Update สถานะครุภัณฑ์ใน HAMS ให้ตรงกับ e-GP อัตโนมัติ | 🟡 **ปานกลาง (Medium)** | 🔮 **แผนในอนาคต (Phase 2)** |

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

### 🟡 7. โมดูล Asset Summary & Statistics (`GET /asset/statistics`)
* **ความต้องการ:**
  * หน้า Frontend ต้องการแสดงกล่อง KPI/Card Summary (เช่น จำนวนครุภัณฑ์ทั้งหมด, ปกติ, ชำรุด, กำลังซ่อม, พร้อมใช้งาน, ถูกยืม) ด้านบนของตารางครุภัณฑ์ที่มี Pagination
* **ปัญหาเดิมหากคำนวณที่ Frontend:**
  * การบังคับดึง `limit=99999` มานับเองทำให้เกิด Network Overhead และหน้าเว็บกระตุก
* **แนวทางแก้ไข (Enterprise Pattern):**
  * เพิ่ม Endpoint `GET /asset/statistics?section_id=...`
  * ใช้ `prisma.asset.count()` และ `prisma.asset.groupBy()` บน PostgreSQL Engine เพื่อความรวดเร็วระดับ milliseconds
  * คืน Response เป็นก้อน JSON ขนาดเล็ก ให้ Frontend นำไปผูกกับ Card Boxes ได้ทันที และสามารถคลิกที่ Card เพื่อ Filter ตารางได้

---

### 🔴 11. บทบาทหัวหน้าช่าง และระบบกระจายงาน (`MAINTENANCE_HEAD` & Workload Balancing)
* **ความต้องการ:**
  * เพิ่ม Role `MAINTENANCE_HEAD` ให้ทำหน้าที่ Triage คัดกรองงาน ระบุหมวดช่าง (`techCategoryId`) และจ่ายงานให้ช่าง
  * รองรับการมอบหมายช่างผู้รับผิดชอบได้หลายคน (`MechanicRepair[]`) และสามารถมอบหมายงานให้ตนเอง (Self-assign) ได้
  * เพิ่ม Endpoint `GET /repairs/mechanic-workloads` คำนวณจำนวนงานค้างของช่างแต่ละคน เพื่อช่วยกระจายงานอย่างสมดุล

---

### 🔴 12. การเบิกอะไหล่แบบผสม และการจ่ายของครบชุด (`WITH_PARTS` & Batch Handover)
* **ความต้องการ:**
  * ยุบรวม `StepActionType` เป็น 4 แทร็ก (`SELF_REPAIR`, `WITH_PARTS`, `OUTSOURCE`, `UNREPAIRABLE`)
  * ฟอร์ม `WITH_PARTS` รองรับรายการอะไหล่หลายชิ้น โดยแต่ละชิ้นระบุ `stockType: "INTERNAL" | "EXTERNAL"` ได้ในใบเดียว
  * หากมีรายการสั่งซื้อภายนอก (`EXTERNAL`) ระบบจะปรับสถานะ Job เป็น `WAITING_PARTS` อัตโนมัติ
  * **Batch Handover & `stock_type` Audit:** เมื่อของครบชุด พัสดุส่งมอบและช่างกดยืนยันรับมอบ (Step 7) พร้อมกันในครั้งเดียว ➔ สร้าง `SPAREPART_TXN` (`WITHDRAW`) ทุกชิ้นใน Timestamp เดียวกัน โดยบันทึกฟิลด์ `stock_type: "INTERNAL" | "EXTERNAL"` กำกับในทุกแถว ทำให้สามารถแยก Badge สีบน UI (`GET /repairs/:id`), กรองรายงาน (`GET /spare-parts/transactions?stockType=...`), และแยกคำนวณต้นทุน Internal vs External Cost ได้อย่างแม่นยำ 100%
  * รองรับ Flow การคืนอะไหล่ที่ไม่ได้ใช้งาน (`txn_type = RETURN`): ช่างถือของมาส่งคืน และ `PARCEL_STAFF` เป็นผู้กดยืนยันการคืนอะไหล่เข้าสต็อกในระบบ

---

### 🔴 13. Flow ส่งมอบเครื่องซ่อมไม่ได้แบบ Custody Handshake (`UNREPAIRABLE`)
* **ความต้องการ:**
  * เมื่อช่างประเมินว่าซ่อมไม่คุ้ม ให้เลือก `UNREPAIRABLE` พร้อมระบุเหตุผลและนำเครื่องส่งที่ห้องพัสดุ
  * เจ้าหน้าที่พัสดุ (`PARCEL_STAFF`) ตรวจรับเครื่องจริงผ่าน `PATCH /repairs/:id/complete-unrepairable`
  * ระบบบันทึก `received_by_user_id`, ปรับสถานะครุภัณฑ์เป็น `WAIT_DISPOSAL` และปิด Job

---

### 🔴 14. โมดูลจำหน่ายครุภัณฑ์แบบ Direct Disposal (`/disposals`)
* **ความต้องการ:**
  * ให้ `PARCEL_STAFF` ทำรายการจำหน่ายได้โดยตรง (ไม่ต้องมีขั้นตอนรออนุมัติหลายขั้น)
  * `POST /disposals` บันทึกเลขที่เอกสาร, วันที่, วิธีการจำหน่าย, เหตุผล, เอกสารแนบ
  * ปรับสถานะครุภัณฑ์เป็น `DISPOSED` และ `UNAVAILABLE` ทันที พร้อมสร้าง Audit History ใน `AssetDisposal`
  * รองรับ `GET /disposals` และ `GET /assets/:id/disposal`

---

### 🔮 15. ระบบยืนยันตัวตนสองขั้นตอน (2FA via Authenticator App) [Phase 2]
* **ความต้องการ:**
  * รองรับ TOTP (Time-based One-Time Password) ร่วมกับ Authenticator App (เช่น Google Authenticator / Microsoft Authenticator)
  * บังคับใช้หรือเปิดใช้งานเฉพาะ Role ที่มีอำนาจจัดการข้อมูลสูงและมีความเสี่ยงต่อระบบ: `ADMIN`, `PARCEL_STAFF`, `ASSET_CENTER_STAFF`
  * มีขั้นตอน Setup QR Code, Secret Key, และหน้าจอยืนยัน 6-digit OTP ระหว่างการ Login

---

### 🔮 16. ระบบแนะนำครุภัณฑ์ในการยืมเพื่อกระจายภาระการใช้งาน (Smart Asset Recommendation) [Phase 2]
* **ความต้องการ:**
  * ออกแบบมาเพื่อแก้ปัญหาการยืมกระจุกตัวอยู่เครื่องเดิมซ้ำๆ (Prevent Asset Hotspot Usage & Wear-and-Tear)
  * ใช้อัลกอริทึมคำนวณจาก **ความถี่และระยะเวลาการถูกยืมในอดีต (Borrow Frequency & Usage Distribution)** เพื่อจัดลำดับแนะนำเครื่องที่ถูกยืมน้อยกว่า หรือเครื่องที่พร้อมใช้งานและหมุนเวียนได้ดีกว่าให้แก่ผู้ขอยืม

---

### 🔮 17. การวิเคราะห์ความคุ้มค่าในการซ่อมรายเครื่องสำหรับการซ่อมครั้งต่อไป (Repair Economic Viability) [Phase 2]
* **ความต้องการ:**
  * ให้ระบบช่วยคำนวณและประเมินความคุ้มค่าเชิงเศรษฐศาสตร์เบื้องต้นเมื่อเครื่องเดิมถูกส่งซ่อมซ้ำ
  * เป็นข้อมูลช่วยประกอบการตัดสินใจของช่าง (`MAINTENANCE_HEAD` / `MAINTENANCE_STAFF`) และผู้บริหารในการเลือกแทร็กซ่อมต่อ หรือแทงชำรุดซื้อทดแทน (`UNREPAIRABLE`)
  * *(สูตรคำนวณและเกณฑ์ชี้วัดตัวเลขจะระบุและสรุปในรายละเอียดอีกครั้งเมื่อเริ่มพัฒนา)*

---

### 🔮 18. ระบบนำเข้าและอัปเดตสถานะครุภัณฑ์แบบกลุ่ม (Bulk CSV / XLSX Status Sync with e-GP) [Phase 2]
* **ความต้องการ:**
  * รองรับการอัปโหลดไฟล์ `.csv` / `.xlsx` ที่ Export ออกมาจากระบบจัดซื้อจัดจ้าง/ทะเบียนพัสดุภาครัฐหลัก (e-GP) เช่น รายการจำหน่ายครุภัณฑ์ประจำปี
  * ระบบ Parse ข้อมูล จับคู่ตาม `noid` (หมายเลขครุภัณฑ์) หรือ `serial_no` และทำ Batch Update สถานะครุภัณฑ์ใน HAMS (เช่น ปรับเป็น `DISPOSED`, `WAIT_DISPOSAL`) ให้ตรงกับระบบ e-GP อย่างรวดเร็วโดยไม่ต้องกดแก้ทีละเครื่อง

---

## 3. โมดูลที่ออกแบบได้ถูกต้องตาม Best Practice แล้ว (Benchmark)
* **`Repairs Module` (`GET /repairs?...`)**: รวม Filter 10 มิติ (`statusCode`, `urgencyStatus`, `actionType`, `stepActionType`, `mechanicId`, `assetId`, `sectionId`, `startDate`, `endDate`, `search`) ไว้ในเส้นเดียว พร้อม Data Isolation ตาม Role
* **`Repair Dispatch & Triage` (`POST /repairs/:id/assign`, `GET /repairs/mechanic-workloads`)**: แยกหน้าที่หัวหน้าช่างชัดเจน พร้อมระบบคำนวณ Workload Balancing
* **`Spare Parts Module` (`GET /spare-parts?...`)**: รองรับ `sparePartGroupId`, `isLowStock`, `search`, `page`, `limit` ในเส้นเดียวชัดเจน
* **`Spare Parts Transactions` (`GET /spare-parts/transactions?...`)**: รองรับ `sparepartId`, `jobId`, `txnType`, `userId`, `startDate`, `endDate`, `page`, `limit` ครบถ้วน
* **`Disposals Module` (`POST /disposals`, `GET /disposals?...`, `GET /assets/:id/disposal`)**: รองรับ Direct Disposal, Filtering ตามช่วงเวลาและวิธีการจำหน่าย พร้อม Pagination
* **`Users Module` (`GET /users?...`)**: รองรับ `role`, `section_id`, `search`, `page`, `limit` ครบถ้วน
* **`Asset Borrow Module` (`GET /borrowings?...`)**: รองรับ `assetId`, `borrowerId`, `borrowStatusId`, `sectionId`, `startDate`, `endDate`, `page`, `limit` ครบถ้วน
* **`Asset Module` (`GET /asset?...`)**: รองรับ `section_id`, `asset_status_id`, `availability_status_id`, `asset_type_id`, `equipment_type_id`, `search`, `page`, `limit` ครบถ้วน
