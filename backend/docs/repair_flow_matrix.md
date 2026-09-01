# คู่มือสรุป Flow และสถานะงานซ่อมบำรุง (Repair Job Flow & Status Matrix)

เอกสารสรุปขั้นตอนการทำงาน (Workflow Steps), การแบ่งขอบเขตฟอร์ม (Form Boundaries), การเปลี่ยนสถานะของงานซ่อมบำรุง (`JobStatus`), และตารางสิทธิ์ผู้ดำเนินการรายขั้นตอน (Step Authority Mapping) แยกตามประเภทการดำเนินการทั้ง 5 เคส (`StepActionType`) โดยละเอียด

---

## 📌 1. คำอธิบายสถานะในระบบ (System Status Definitions)

### 1.1 สถานะงานซ่อม (`JobStatus`)
- **`WAITING_HANDOVER`** : รอรับเครื่องจากหน่วยงาน (หน่วยงานแจ้งซ่อมออนไลน์แล้ว แต่ยังไม่ได้ส่งมอบเครื่องเข้าศูนย์ซ่อม)
- **`PENDING_ASSIGN`** : รอมอบหมายงานให้ช่าง (ศูนย์ซ่อมได้รับเรื่องแล้ว อยู่ระหว่างจ่ายงานให้ช่าง)
- **`IN_PROGRESS`** : ช่างกำลังดำเนินการซ่อม (ช่างรับงาน วินิจฉัย และกำลังดำเนินการซ่อมแซม/ทดสอบ)
- **`WAITING_PARTS`** : สั่งซื้อ/รออะไหล่ (อยู่ระหว่างรอจัดซื้ออะไหล่นอกคลัง หรือรอร้านค้า/บริษัทส่งอะไหล่)
- **`PARCEL_PROCESSING`** : พัสดุกำลังดำเนินการ (ติดอยู่ที่ขั้นตอนทางเอกสารพัสดุ / ขออนุมัติเบิก / ตรวจรับอะไหล่เข้าคลัง)
- **`OUTSOURCED`** : ส่งซ่อมบริษัทภายนอก (เครื่องถูกส่งออกไปซ่อมที่บริษัท/ตัวแทนจำหน่ายภายนอกโรงพยาบาล)
- **`UNREPAIRABLE`** : แทงชำรุด/เห็นควรจำหน่าย (ช่างประเมินแล้วซ่อมไม่คุ้ม/ซ่อมไม่ได้ เสนอซื้อทดแทนหรือทำเรื่องจำหน่าย)
- **`WAITING_DELIVERY`** : เสร็จแล้วรอรับคืน (ดำเนินการซ่อม/ทดสอบเรียบร้อย รอหน่วยงานมารับเครื่องกลับไปใช้งาน)
- **`COMPLETED`** : ส่งคืน/ดำเนินการเรียบร้อย (หน่วยงานตรวจรับเครื่องเรียบร้อย บันทึกประกัน และปิด Job สมบูรณ์)
- **`CANCELLED`** : ยกเลิกงานซ่อม (ยกเลิกรายการแจ้งซ่อม เช่น แจ้งซ้ำ, ใช้งานได้ปกติแล้ว)

### 1.2 สถานะครุภัณฑ์ (`AssetStatus` & `AvailabilityStatus`)
- **แจ้งซ่อม** ➔ `UNDER_REPAIR` (กำลังซ่อม) & `UNAVAILABLE` (ไม่พร้อมใช้งาน)
- **ตรวจรับ/ปิด Job (ซ่อมสำเร็จ)** ➔ `NORMAL` (ปกติ) & `AVAILABLE` (พร้อมใช้งาน)
- **ตรวจรับ/ปิด Job (แทงชำรุด/ซื้อทดแทน)** ➔ `WAIT_DISPOSAL` (รอจำหน่าย) & `UNAVAILABLE` (ไม่พร้อมใช้งาน)

---

## 🛡️ 2. กฎการควบคุมสิทธิ์รายขั้นตอน (Strict Separation of Duties)

> ⚠️ **กฎสำคัญ:** 
> - `ADMIN` จะ **ไม่มีบทบาทในขั้นตอนปฏิบัติการงานซ่อม (Operational Workflow)**
> - `MANAGER` (ผู้บริหาร) จะมีบทบาทอนุมัติ **เฉพาะเคสขอซื้อเครื่องใหม่ทดแทนใน Step 6 เท่านั้น** ส่วนการอนุมัติจัดหา/สั่งซื้ออะไหล่/ส่งซ่อมนอก (Step 5) จะเป็นอำนาจหน้าที่ของ `PARCEL_STAFF` (เจ้าหน้าที่พัสดุ) ทั้งหมด

| ขั้นตอน (Step Description) | ผู้มีสิทธิ์กดในระบบ (Designated Roles) |
|---|:---:|
| **Step 1: แจ้งซ่อม** | ทุก Role (`DEPARTMENT_STAFF`, `MAINTENANCE_STAFF` ฯลฯ) |
| **Step 2-4: รับงาน, วินิจฉัย, วางแผนเคส** | `MAINTENANCE_STAFF` |
| **Step 5: อนุมัติจัดหา / อนุมัติส่งซ่อม (Stock / Outsource)** | **`PARCEL_STAFF`** |
| **Step 5: พัสดุตรวจสอบขอซื้อทดแทน (Replacement)** | **`PARCEL_STAFF`** |
| **Step 6: ผู้บริหารอนุมัติขอซื้อทดแทน (Replacement)** | **`MANAGER`** |
| **พัสดุจ่ายอะไหล่ / รับของเข้าคลัง (Step 6 ใน Stock หรือ Step 7 ใน Replacement)** | **`PARCEL_STAFF`** |
| **ช่างรับอะไหล่ / ดำเนินการซ่อม / ตั้งค่าเครื่อง** | `MAINTENANCE_STAFF` |
| **ตรวจรับงานและปิด Job (Step สุดท้าย - ส่งมอบคืน)** | `MAINTENANCE_STAFF` (ระบุชื่อผู้มารับมอบ `receiverId`) |

---

## 🛠️ 3. ตารางขั้นตอนการซ่อมแยกตามเคส (`StepActionType`)

### 3.1 เคสที่ 1: `SELF_REPAIR` (ดำเนินการซ่อมเอง - ไม่ใช้อะไหล่) - 6 Steps

| Step # | ขั้นตอนการทำงาน (Step Label) | ขอบเขต (Boundary) | สิทธิ์ผู้กด (Role) | JobStatus | Asset Status |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **1** | วันแจ้งซ่อม | ช่วงที่ 1 | User ทุกคน | `PENDING_ASSIGN` | `UNDER_REPAIR` |
| **2** | ธุรการรับ Job / จ่ายงาน | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | `IN_PROGRESS` | `UNDER_REPAIR` |
| **3** | ช่างรับ Job / วินิจฉัย | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | `IN_PROGRESS` | `UNDER_REPAIR` |
| **4** | ดำเนินการซ่อมและทดสอบการใช้งาน | ช่วงที่ 3 | `MAINTENANCE_STAFF` | **`IN_PROGRESS`** | `UNDER_REPAIR` |
| **5** | แล้วเสร็จ / รอตรวจรับงาน | ช่วงที่ 3 | `MAINTENANCE_STAFF` | **`WAITING_DELIVERY`** 🔔 | `UNDER_REPAIR` |
| **6** | ตรวจรับงานและสรุป Job (ส่งมอบคืน) | ช่วงที่ 3 | `MAINTENANCE_STAFF` (ระบุชื่อผู้มารับมอบ) | **`COMPLETED`** ✅ | `NORMAL` / `AVAILABLE` |

---

### 3.2 เคสที่ 2: `INTERNAL_STOCK` (เบิกใช้วัสดุ/อะไหล่ในคลัง) - 9 Steps

| Step # | ขั้นตอนการทำงาน (Step Label) | ขอบเขต (Boundary) | สิทธิ์ผู้กด (Role) | JobStatus | Asset Status |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **1** | วันแจ้งซ่อม | ช่วงที่ 1 | User ทุกคน | `PENDING_ASSIGN` | `UNDER_REPAIR` |
| **2** | ธุรการรับ Job / จ่ายงาน | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | `PARCEL_PROCESSING` | `UNDER_REPAIR` |
| **3** | ช่างรับ Job / วินิจฉัย | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | `PARCEL_PROCESSING` | `UNDER_REPAIR` |
| **4** | ขอเบิกอะไหล่ในคลัง | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | **`PARCEL_PROCESSING`** 📦 | `UNDER_REPAIR` |
| **5** | อนุมัติจัดหาอะไหล่ในคลัง | ช่วงที่ 3 | **`PARCEL_STAFF`** | **`PARCEL_PROCESSING`** 📦 | `UNDER_REPAIR` |
| **6** | พัสดุจ่ายอะไหล่ในคลัง | ช่วงที่ 3 | **`PARCEL_STAFF`** | **`IN_PROGRESS`** 🔧 | `UNDER_REPAIR` |
| **7** | ช่างรับวัสดุ/ดำเนินการซ่อม | ช่วงที่ 3 | `MAINTENANCE_STAFF` | **`IN_PROGRESS`** 🔧 | `UNDER_REPAIR` |
| **8** | แล้วเสร็จ / รอตรวจรับงาน | ช่วงที่ 3 | `MAINTENANCE_STAFF` | **`WAITING_DELIVERY`** 🔔 | `UNDER_REPAIR` |
| **9** | ตรวจรับงานและสรุป Job (ส่งมอบคืน) | ช่วงที่ 3 | `MAINTENANCE_STAFF` (ระบุชื่อผู้มารับมอบ) | **`COMPLETED`** ✅ | `NORMAL` / `AVAILABLE` |

---

### 3.3 เคสที่ 3: `EXTERNAL_STOCK` (สั่งซื้อ/จัดหาอะไหล่นอกคลัง) - 9 Steps

| Step # | ขั้นตอนการทำงาน (Step Label) | ขอบเขต (Boundary) | สิทธิ์ผู้กด (Role) | JobStatus | Asset Status |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **1** | วันแจ้งซ่อม | ช่วงที่ 1 | User ทุกคน | `PENDING_ASSIGN` | `UNDER_REPAIR` |
| **2** | ธุรการรับ Job / จ่ายงาน | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | `PARCEL_PROCESSING` | `UNDER_REPAIR` |
| **3** | ช่างรับ Job / วินิจฉัย | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | `PARCEL_PROCESSING` | `UNDER_REPAIR` |
| **4** | ขอเบิก/จัดซื้ออะไหล่นอกคลัง | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | **`PARCEL_PROCESSING`** 📦 | `UNDER_REPAIR` |
| **5** | อนุมัติจัดหาอะไหล่นอกคลัง | ช่วงที่ 3 | **`PARCEL_STAFF`** | **`WAITING_PARTS`** ⏳ | `UNDER_REPAIR` |
| **6** | พัสดุแจ้งรับอะไหล่ | ช่วงที่ 3 | **`PARCEL_STAFF`** | **`PARCEL_PROCESSING`** 📦 | `UNDER_REPAIR` |
| **7** | ช่างรับอะไหล่/ดำเนินการซ่อม | ช่วงที่ 3 | `MAINTENANCE_STAFF` | **`IN_PROGRESS`** 🔧 | `UNDER_REPAIR` |
| **8** | แล้วเสร็จ / รอตรวจรับงาน | ช่วงที่ 3 | `MAINTENANCE_STAFF` | **`WAITING_DELIVERY`** 🔔 | `UNDER_REPAIR` |
| **9** | ตรวจรับงานและสรุป Job (ส่งมอบคืน) | ช่วงที่ 3 | `MAINTENANCE_STAFF` (ระบุชื่อผู้มารับมอบ) | **`COMPLETED`** ✅ | `NORMAL` / `AVAILABLE` |

---

### 3.4 เคสที่ 4: `OUTSOURCE` (ส่งซ่อมบริษัทภายนอก / ผู้เชี่ยวชาญ) - 9 Steps

| Step # | ขั้นตอนการทำงาน (Step Label) | ขอบเขต (Boundary) | สิทธิ์ผู้กด (Role) | JobStatus | Asset Status |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **1** | วันแจ้งซ่อม | ช่วงที่ 1 | User ทุกคน | `PENDING_ASSIGN` | `UNDER_REPAIR` |
| **2** | ธุรการรับ Job / จ่ายงาน | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | `PARCEL_PROCESSING` | `UNDER_REPAIR` |
| **3** | ช่างรับ Job / วินิจฉัย | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | `PARCEL_PROCESSING` | `UNDER_REPAIR` |
| **4** | ขอส่งซ่อมบริษัทภายนอก | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | **`PARCEL_PROCESSING`** 📦 | `UNDER_REPAIR` |
| **5** | อนุมัติส่งซ่อมบริษัทภายนอก | ช่วงที่ 3 | **`PARCEL_STAFF`** | **`OUTSOURCED`** 🚚 | `UNDER_REPAIR` |
| **6** | พัสดุรับเครื่องกลับจากบริษัท | ช่วงที่ 3 | **`PARCEL_STAFF`** | **`PARCEL_PROCESSING`** 📦 | `UNDER_REPAIR` |
| **7** | ช่างรับเครื่องและทดสอบ | ช่วงที่ 3 | `MAINTENANCE_STAFF` | **`IN_PROGRESS`** 🔧 | `UNDER_REPAIR` |
| **8** | แล้วเสร็จ / รอตรวจรับงาน | ช่วงที่ 3 | `MAINTENANCE_STAFF` | **`WAITING_DELIVERY`** 🔔 | `UNDER_REPAIR` |
| **9** | ตรวจรับงานและสรุป Job (ส่งมอบคืน) | ช่วงที่ 3 | `MAINTENANCE_STAFF` (ระบุชื่อผู้มารับมอบ) | **`COMPLETED`** ✅ | `NORMAL` / `AVAILABLE` |

---

### 3.5 เคสที่ 5: `PURCHASE_REPLACEMENT` (แทงชำรุด / ขอซื้อเครื่องทดแทน - Two-tier Approval) - 10 Steps

| Step # | ขั้นตอนการทำงาน (Step Label) | ขอบเขต (Boundary) | สิทธิ์ผู้กด (Role) | JobStatus | Asset Status |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **1** | วันแจ้งซ่อม | ช่วงที่ 1 | User ทุกคน | `PENDING_ASSIGN` | `UNDER_REPAIR` |
| **2** | ธุรการรับ Job / จ่ายงาน | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | `UNREPAIRABLE` | `UNDER_REPAIR` |
| **3** | ช่างรับ Job / วินิจฉัย | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | `UNREPAIRABLE` | `UNDER_REPAIR` |
| **4** | ขอซื้อเครื่องทดแทน | ช่วงที่ 2 (ฟอร์มวินิจฉัย) | ช่าง (`MAINTENANCE_STAFF`) | **`UNREPAIRABLE`** 🏷️ | `UNDER_REPAIR` |
| **5** | **พัสดุตรวจสอบและเสนอความเห็น** | ช่วงที่ 3 | **`PARCEL_STAFF`** | **`PARCEL_PROCESSING`** 📦 | `UNDER_REPAIR` |
| **6** | **ผู้บริหารอนุมัติการจัดซื้อเครื่องทดแทน** | ช่วงที่ 3 | **`MANAGER`** | **`PARCEL_PROCESSING`** 📦 | `UNDER_REPAIR` |
| **7** | พัสดุรับเครื่องใหม่เข้าคลัง | ช่วงที่ 3 | **`PARCEL_STAFF`** | **`PARCEL_PROCESSING`** 📦 | `UNDER_REPAIR` |
| **8** | ช่างรับเครื่องใหม่และส่งมอบ | ช่วงที่ 3 | `MAINTENANCE_STAFF` | **`IN_PROGRESS`** 🔧 | `UNDER_REPAIR` |
| **9** | แล้วเสร็จ / รอตรวจรับงาน | ช่วงที่ 3 | `MAINTENANCE_STAFF` | **`WAITING_DELIVERY`** 🔔 | `UNDER_REPAIR` |
| **10** | ตรวจรับงานและสรุป Job (ส่งมอบเครื่องใหม่) | ช่วงที่ 3 | `MAINTENANCE_STAFF` (ระบุชื่อผู้มารับมอบ) | **`COMPLETED`** ✅ | `WAIT_DISPOSAL` / `UNAVAILABLE` |
