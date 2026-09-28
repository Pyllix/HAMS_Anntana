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
| 15 | **`Auth: Two-Factor Authentication (2FA via Auth App)`** | **ระบบยืนยันตัวตน 2 ชั้นด้วย Authenticator App (TOTP)**<br>บังคับใช้เฉพาะ `ADMIN`, `PARCEL_STAFF`, `ASSET_CENTER_STAFF`; Role อื่นไม่ต้องเปิดใช้ 2FA | 🟡 **ปานกลาง (Medium)** | 🔮 **แผนในอนาคต (Phase 2)** |
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
  * บังคับใช้เฉพาะ Role `ADMIN`, `PARCEL_STAFF`, `ASSET_CENTER_STAFF`; Role อื่นไม่ต้องเปิดใช้ 2FA
  * ผู้ใช้ใน Role ที่ถูกบังคับต้องลงทะเบียนและยืนยัน TOTP สำเร็จก่อน ระบบจึงจะออก Session ปกติและอนุญาตให้เรียก Business API; ไม่มีช่วงที่ใช้งานระบบปกติได้โดยยังไม่เปิด 2FA
  * 2FA เปิดใช้พร้อมการ Deploy และส่งมอบระบบครั้งแรก จึงบังคับ Enrollment Gate ตั้งแต่การล็อกอิน Production ครั้งแรก ไม่มีช่วงย้าย Session ผู้ใช้เดิมหรือการแจ้งเปลี่ยนผ่านให้ผู้ใช้เดิม
  * เตรียม Production แยกจาก `prisma/seed.ts` ซึ่งเป็นข้อมูลทดลอง: แยกเฉพาะข้อมูลอ้างอิงที่ระบบต้องใช้จริงออกเป็น Production seed และมีขั้นตอน Bootstrap ครั้งเดียวสำหรับบัญชี `ADMIN` ของผู้รับผิดชอบจริง 2 คน โดยไม่ฝังรหัสผ่านในโค้ด/Log และรันซ้ำแล้วต้องไม่สร้างบัญชีซ้ำหรือทับรหัสผ่านเดิม; ห้ามรัน Mock seed ทั้งชุดบน Production
  * ให้ `ADMIN` ทั้ง 2 คนยืนยันอีเมลและลงทะเบียน TOTP ด้วยตนเองก่อนส่งมอบให้ใช้งานตามปกติ; ระหว่าง Bootstrap อนุญาตเฉพาะ Flow ตั้งค่าบัญชี/2FA และตรวจสอบว่าทั้งสองบัญชีพร้อมใช้งานก่อนส่งมอบ
  * บัญชี `ADMIN` สองคนแรกใช้รหัสผ่านเริ่มต้นที่สุ่มแยกกัน ส่งให้เจ้าของบัญชีเป็นการส่วนตัวโดยไม่บันทึกในโค้ดหรือ Log; เจ้าของบัญชีเลือกเปลี่ยนรหัสผ่านเองได้ แต่ไม่บังคับให้เปลี่ยนก่อน Enrollment 2FA โดยยังต้องยืนยันอีเมลและตั้ง TOTP ด้วยตนเองก่อนเข้า Business API
  * บัญชีที่ `ADMIN` เพิ่มภายหลังทุก Role ไม่ถูกบังคับให้เปลี่ยนรหัสผ่านเมื่อเข้าใช้ครั้งแรก; ผู้ใช้เลือกเปลี่ยนเองได้ตามต้องการ และ Role ที่อยู่ในขอบเขต 2FA ยังต้องผ่าน Enrollment Gate ตามปกติ (ยอมรับว่าผู้จัดเตรียมบัญชีอาจทราบรหัสผ่านเริ่มต้นหากผู้ใช้ไม่เปลี่ยน)
  * ปิดช่องสมัครบัญชีเองจากภายนอกของ Better Auth (`POST /api/auth/sign-up/email`) ด้วย `disabledPaths: ['/sign-up/email']` แต่คงการเพิ่มผู้ใช้ผ่าน `POST /users` ที่บังคับ Role `ADMIN` และการเรียกสร้างบัญชีภายใน Backend ตามเดิม; ไม่ต้องเปลี่ยนหน้าจอเพิ่มผู้ใช้เพราะข้อนี้โดยเฉพาะ และต้องทดสอบว่าช่องสมัครเองถูกปิดจริง ขณะที่ ADMIN ยังเพิ่มผู้ใช้และส่งอีเมลยืนยันได้ตามเดิม
  * ตรวจเส้นทางจัดการผู้ใช้ที่ Better Auth เปิดโดยตรง (รวมถึง `/api/auth/admin/create-user`) ไม่ให้ข้ามข้อกำหนดเฉพาะ HAMS เช่น สิทธิ์ `ADMIN` ฝั่ง Server ข้อมูลพนักงาน การกำหนด Role และ Audit Log ของการสร้าง `ADMIN`/เปลี่ยน Role
  * เปลี่ยน Web Session ของ React เป็น BetterAuth Session ผ่าน `Secure` + `HttpOnly` Cookie โดยไม่ส่ง Session Token กลับใน JSON และไม่เก็บ Token ใน `localStorage`; การออก Session ปกติต้องเกิดหลังผ่าน 2FA Enrollment/Verification Gate เท่านั้น ([ADR-0003](docs/adr/0003-browser-session-in-httponly-cookie.md))
  * กำหนด `SameSite` ตามรูปแบบโดเมนที่ใช้งานจริง, ใช้ HTTPS, ป้องกัน CSRF ในคำขอที่เปลี่ยนข้อมูล, จำกัด CORS เป็น Frontend Origin ที่ระบุชัดเจนแทน `origin: true`, และกำหนดอายุ/การเพิกถอน Session ฝั่ง Server
  * แผน Deployment เบื้องต้นคือ Frontend บน Vercel และ Backend บน Render (ยังไม่ Deploy Frontend): ให้ Browser เรียก API ผ่าน Vercel `/api` Proxy แบบ Same-origin โดยเพิ่ม Rewrite ไป Render ก่อน SPA Fallback ใน `vercel.json`, เปลี่ยน Frontend ให้ใช้ API Base Path `/api` จากจุดกลาง และส่ง Session Cookie แบบ Host-only ไม่กำหนด `Domain`; ทดสอบ `Set-Cookie`, Sign-in/Sign-out, CSRF และ Browser ที่บล็อก Third-party Cookies บน Preview Deployment ก่อนเปิดใช้จริง
  * Response ที่มีข้อมูลยืนยันตัวตนหรือข้อมูลเฉพาะผู้ใช้ต้องส่ง `Cache-Control: no-store` และห้ามตั้งค่า Cache ให้ Vercel `/api` Proxy; หากเปลี่ยนแผนโดเมนหรือ Hosting ต้องทบทวนการตั้งค่า Cookie และ Origin ใหม่
  * Web Session มีอายุสูงสุด 12 ชั่วโมงแบบ Absolute Expiry นับจากล็อกอิน แม้ผู้ใช้ยังใช้งานอยู่ก็ไม่ต่ออายุ; เมื่อ Session หมดอายุต้องกรอกรหัสผ่านใหม่ โดย Trusted Browser 14 วันใช้ข้ามการกรอก TOTP เท่านั้น ไม่ยืดอายุ Session
  * หากไม่มีการใช้งานจริงใน HAMS ติดต่อกัน 60 นาที ให้ Session หมดอายุฝั่ง Server และแจ้งเตือนก่อนครบเวลา 5 นาทีพร้อมปุ่มให้ผู้ใช้ที่ยังอ่านหน้าจอกดใช้งานต่อ; นับการคลิก พิมพ์ เลื่อนหน้า หรือเปิดข้อมูลที่ผู้ใช้สั่งเองเป็นกิจกรรม แต่การดึงข้อมูลอัตโนมัติ/Background Polling หรือการเปิดหน้าค้างเฉย ๆ ไม่ต่อเวลา และการต่อเวลาไม่เปลี่ยนกำหนด Absolute Expiry 12 ชั่วโมง
  * การปิดแท็บหรือ Browser ไม่ถือเป็น Sign-out; เมื่อกลับมาเปิด HAMS ใหม่ภายใน 60 นาทีที่ไม่มีการใช้งานและก่อนครบ Absolute Expiry 12 ชั่วโมง ให้ตรวจ Session ฝั่ง Server แล้วเข้าใช้งานต่อได้โดยไม่ต้องล็อกอินใหม่ ส่วนการกด Sign-out ต้องเพิกถอน Session ปัจจุบันฝั่ง Server และล้าง Session Cookie ทันที
  * บัญชีเดียวกันเข้าใช้พร้อมกันหลายเครื่องได้ โดยแต่ละเครื่องมี Session และการยืนยัน 2FA/Trusted Browser แยกจากกัน การล็อกอินบนเครื่องใหม่ไม่เพิกถอน Session ของเครื่องเดิม; เมื่อรีเซ็ตรหัสผ่านหรือรีเซ็ต 2FA ต้องเพิกถอน Session และ Trusted Browser ของบัญชีนั้นทุกเครื่อง ครั้งถัดไปต้องยืนยัน TOTP หรือ Enrollment ใหม่ตามสถานะ ก่อนเลือกเชื่อถือเครื่องอีกครั้ง
  * เมื่อเจ้าของบัญชีเปลี่ยนรหัสผ่านเองโดยยืนยันรหัสผ่านเดิม ให้คง Session ของเครื่องปัจจุบันไว้ เพิกถอน Session เครื่องอื่นและ Trusted Browser ทุกเครื่อง; เมื่อ Session ปัจจุบันหมดอายุ การล็อกอินครั้งถัดไปต้องยืนยัน 2FA ใหม่ก่อนเลือกเชื่อถือเครื่องอีกครั้ง
  * เมื่อ Session หมดอายุระหว่างกรอกแบบฟอร์ม ให้ปิดบังข้อมูลและแสดงหน้าล็อกอินทับงานเดิม ห้ามส่งคำขอแก้ไขข้อมูลจนยืนยันตัวตนใหม่; เก็บข้อมูลที่ยังไม่บันทึกไว้ในแท็บปัจจุบันเพื่อให้เฉพาะบัญชีเดิมกลับมาทำต่อได้ หากล็อกอินเป็นบัญชีอื่นต้องล้างข้อมูลค้างและไม่ให้เห็นฟอร์มเดิม
  * เมื่อมีข้อมูลแบบฟอร์มที่ยังไม่บันทึก ให้เตือนก่อนรีเฟรชหรือปิดแท็บตามที่ Browser รองรับ; การกลับมาทำต่อหลัง Session หมดอายุรับประกันเฉพาะแท็บเดิมที่ยังเปิดอยู่ ไม่รับประกันการกู้ข้อมูลหลังรีเฟรชหรือปิดแท็บ
  * ตรวจและปรับกลไก Draft/ข้อมูลค้างที่มีอยู่ใน Frontend (รวมถึงที่เก็บใน `localStorage`) ไม่ให้ข้อมูลของบัญชีหนึ่งถูกกู้หรือแสดงแก่บัญชีอื่นเมื่อสลับบัญชีหรือ Session หมดอายุ
  * ปรับ Frontend ให้ส่ง Cookie กับทุกคำขอที่ต้องยืนยันตัวตน ใช้ข้อมูลจาก Session Endpoint เพื่อคืนสถานะ Login หลังเปิดหน้าใหม่ และเลิกสร้าง `Authorization: Bearer` จาก Token ใน `localStorage`; เพิ่มหน้าจอ Enrollment, TOTP, Recovery Code และ Trusted Browser ตาม Flow นี้
  * Admin สร้างบัญชีได้ แต่ก่อนยืนยัน TOTP บัญชีต้องเข้าได้เฉพาะ 2FA Enrollment Flow; เจ้าของบัญชีเป็นผู้ผูก Authenticator ด้วยตนเอง และ Admin ต้องไม่เห็นหรือเก็บ Secret Key แทนผู้ใช้
  * มีขั้นตอน Setup QR Code, Secret Key, และหน้าจอยืนยัน 6-digit OTP ระหว่างการ Login; Secret Key สำหรับ TOTP ต้องเข้ารหัสเมื่อจัดเก็บ
  * หลังยืนยัน TOTP ให้สร้าง Recovery Codes 10 รหัส แสดงให้ผู้ใช้เก็บเพียงครั้งเดียวและบังคับให้ยืนยันว่าเก็บแล้วก่อนจบ Enrollment; แต่ละรหัสใช้ได้ครั้งเดียวและจัดเก็บในฐานข้อมูลเป็นแฮชแบบทางเดียว ไม่เก็บรหัสที่ถอดกลับมาอ่านได้
  * รองรับ Admin-assisted 2FA Reset เมื่อผู้ใช้สูญเสีย Authenticator และ Recovery Codes โดยต้องเป็น `ADMIN` คนอื่นหลังตรวจตัวตนนอกระบบและ Step-up TOTP พร้อมเพิกถอน Session/Trusted Browser ทั้งหมด ลบ 2FA credential ชุดเดิม บันทึก Audit Log ส่งอีเมลแจ้งเจ้าของบัญชีหลังรีเซ็ต และบังคับ Enrollment ใหม่ก่อนเข้าใช้ Business API
  * ก่อนส่งมอบต้องมี `ADMIN` ที่ Active และผ่าน 2FA Enrollment อย่างน้อย 2 บัญชี; หลังเปิดใช้ถือเป็นแนวปฏิบัติ ไม่บังคับจำนวน 2 คนตลอดเวลาในระบบ หากรีเซ็ต 2FA ของหนึ่งในสองคน อนุญาตให้เหลือผู้พร้อมกู้บัญชี 1 คนระหว่าง Enrollment ใหม่ แต่ห้ามลบ ปิดใช้งาน หรือเปลี่ยน Role ของ `ADMIN` คนสุดท้ายที่ Active และผ่าน Enrollment
  * รองรับ Trusted Browser 14 วันแบบ Absolute Expiry บนเครื่องประจำหรือเครื่องงานที่มีผู้ใช้ร่วมกันเป็นครั้งคราว โดยผู้ใช้เลือกเองและช่องเลือกต้องไม่ถูกติ๊กไว้ล่วงหน้า; Trust ผูกกับ `userId` และ Browser token และให้มีบัญชีที่ได้รับ Trust ได้เพียงบัญชีเดียวต่อ Browser Profile ในเวลาเดียวกัน
  * เมื่อบัญชีอื่นล็อกอินผ่าน Browser Profile ที่มี Trust อยู่ ให้เพิกถอน Trust เดิมอัตโนมัติ บัญชีใหม่ต้องยืนยัน TOTP ก่อนจึงจะเลือกเชื่อถือ Browser นั้นได้ ไม่จัด Browser เป็นเครื่องใช้ร่วมกันแบบถาวรหรือห้าม Trusted Browser ในอนาคต
  * ห้าม `ADMIN`, `PARCEL_STAFF`, `ASSET_CENTER_STAFF` ปิด 2FA; อนุญาตเฉพาะเปลี่ยน Authenticator โดยยืนยันรหัสผ่านและ TOTP ปัจจุบัน หรือรีเซ็ต 2FA แล้วเพิกถอน Session และกลับเข้า Enrollment Gate
  * บังคับ Step-up TOTP แม้ Browser ยัง Trusted ก่อนเปลี่ยน/รีเซ็ต 2FA สร้าง Recovery Codes ชุดใหม่ หรือดำเนินการ Admin Reset Password ให้ผู้ใช้อื่น; การสร้างบัญชี `ADMIN` และการเปลี่ยน Role ทุกกรณีไม่ขอ Step-up TOTP เพิ่ม แต่ต้องตรวจสิทธิ์ `ADMIN` ฝั่ง Server และบันทึก Audit Log โดย Role ที่อยู่ในขอบเขต 2FA ยังต้องผ่าน Enrollment Gate
  * ยอมรับความเสี่ยงของการไม่ขอ Step-up ในสองกรณีนี้: หากมีผู้เข้าถึง Session `ADMIN` ที่เปิดค้างอยู่ (รวมถึงบน Trusted Browser) ผู้นั้นอาจสร้าง `ADMIN` หรือเปลี่ยน Role ได้โดยไม่ต้องมี TOTP ใหม่; มาตรการที่ยังคงใช้คือ Session Timeout, Cookie/CSRF Protection, RBAC ฝั่ง Server, Audit Log และการเพิกถอน Session/Trusted Browser ของบัญชีที่ถูกเปลี่ยน Role
  * แม้การเปลี่ยน Role ไม่ใช่ Use Case ปกติของโรงพยาบาล หากมีการเปลี่ยน Role ของบัญชีใดจริง ให้เพิกถอน Session และ Trusted Browser ของบัญชีนั้นทุกเครื่องทันที แล้วบังคับล็อกอินใหม่ตาม Role ใหม่ (รวมถึง Enrollment/Verification 2FA ถ้า Role ใหม่อยู่ในขอบเขตบังคับ); การแก้ข้อมูลโปรไฟล์อื่นโดยไม่เปลี่ยน Role ไม่ต้องเพิกถอนด้วยเหตุนี้
  * Step-up TOTP สำเร็จแล้วให้ยกระดับสิทธิ์เฉพาะ Admin และ Session ปัจจุบันเป็นเวลา 5 นาที รองรับการ Reset Password หลายบัญชีในช่วงเดียว และยกเลิกทันทีเมื่อ Sign-out, Session ถูก revoke หรือ Admin เปลี่ยนรหัสผ่าน/2FA
  * นับ TOTP และ Recovery Code ที่ผิดติดต่อกันร่วมกัน ผิดครบ 5 ครั้งให้ล็อกการยืนยัน 2FA ของบัญชี 10 นาที พร้อม Audit Log; ยืนยันสำเร็จให้ล้างตัวนับ และไม่ปิดบัญชีถาวร
  * กำหนด TOTP เป็นรหัส 6 หลัก รอบละ 30 วินาที และยอมรับ previous/current/next time step (`window = 1`) เพื่อรองรับ clock skew ประมาณ ±30 วินาที

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
* **`Outsource Repairs & Cost Tracking` (`company_id`, `bill_no`, `repair_cost`)**: บันทึกบริษัทคู่ค้า เลขที่ใบสั่งจ้าง/ใบแจ้งหนี้ และจำนวนเงินค่าใช้จ่ายการซ่อมจริง (`repair_cost`) โดยเจ้าหน้าที่พัสดุ
* **`Spare Parts Module` (`GET /spare-parts?...`)**: รองรับ `sparePartGroupId`, `isLowStock`, `search`, `page`, `limit` ในเส้นเดียวชัดเจน
* **`Spare Parts Transactions` (`GET /spare-parts/transactions?...`)**: รองรับ `sparepartId`, `jobId`, `txnType`, `userId`, `startDate`, `endDate`, `page`, `limit` ครบถ้วน
* **`Disposals Module` (`POST /disposals`, `GET /disposals?...`, `GET /assets/:id/disposal`)**: รองรับ Direct Disposal, Filtering ตามช่วงเวลาและวิธีการจำหน่าย พร้อม Pagination
* **`Users Module` (`GET /users?...`)**: รองรับ `role`, `section_id`, `search`, `page`, `limit` ครบถ้วน
* **`Asset Borrow Module` (`GET /borrowings?...`)**: รองรับ `assetId`, `borrowerId`, `borrowStatusId`, `sectionId`, `startDate`, `endDate`, `page`, `limit` ครบถ้วน
* **`Asset Module` (`GET /asset?...`)**: รองรับ `section_id`, `asset_status_id`, `availability_status_id`, `asset_type_id`, `equipment_type_id`, `search`, `page`, `limit` ครบถ้วน
