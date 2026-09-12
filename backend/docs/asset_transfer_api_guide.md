# 📘 คู่มือการใช้งาน API: Asset Transfer Module
# (ระบบโอนย้ายครุภัณฑ์ระหว่างแผนก/วอร์ด)

เอกสารแนะนำการใช้งาน API ระบบการโอนย้ายครุภัณฑ์ (**Asset Transfer**) สำหรับนักพัฒนาหน้าบ้าน (Frontend), เจ้าหน้าที่ศูนย์เครื่องมือแพทย์ (**ASSET_CENTER_STAFF**) และเจ้าหน้าที่งานพัสดุ (**PARCEL_STAFF**)

---

## 🧭 1. ภาพรวมของ API (Transfer Endpoints)

| Method | Endpoint Path | สิทธิ์การเข้าถึง (Roles) | วัตถุประสงค์และการใช้งานบนหน้าจอ |
| :---: | :--- | :--- | :--- |
| **`POST`** | `/asset/:id/transfer` | **เฉพาะ `ASSET_CENTER_STAFF` และ `PARCEL_STAFF` เท่านั้น** | **บันทึกการโอนย้ายครุภัณฑ์:** ย้ายแผนกของเครื่องนั้นไปยังแผนกใหม่ พร้อมบันทึกประวัติลงตาราง `transfer` ใน Transaction เดียวกัน |
| **`GET`** | `/asset/:id/transfer`<br>*(Alias: `/asset/:id/transfers`)* | ทุกบทบาทที่เกี่ยวข้อง (`ADMIN`, `MANAGER`, `ASSET_CENTER_STAFF`, `PARCEL_STAFF`, `MAINTENANCE_STAFF`, `DEPARTMENT_STAFF`) | **ดูประวัติการโอนย้ายเฉพาะเครื่อง:** แสดงเส้นทางการย้ายสถานที่ในอดีตของเครื่องนั้น |
| **`GET`** | `/asset/transfer`<br>*(Alias: `/asset/transfers`)* | ทุกบทบาทที่เกี่ยวข้อง | **หน้ารวมประวัติการโอนย้ายทั้งโรงพยาบาล:** สำหรับหน้าจอ Audit / รายงานการเคลื่อนย้ายครุภัณฑ์ รองรับการแบ่งหน้า ค้นหาเลขที่เอกสาร รหัสครุภัณฑ์ หรือชื่อแผนก |

---

## 🛡️ 2. เงื่อนไขและกฎความปลอดภัยทางธุรกิจ (Business Rules & Guards)

การเรียกใช้งาน `POST /asset/:id/transfer` มีการตรวจสอบความถูกต้องอย่างเข้มงวด:

1. **สิทธิ์การใช้งาน (RBAC):**
   - อนุญาต **เฉพาะ** ผู้ใช้ที่มีบทบาท `ASSET_CENTER_STAFF` หรือ `PARCEL_STAFF` เท่านั้น (ผู้ใช้บทบาทอื่นจะได้รับ `HTTP 403 Forbidden`)
2. **บล็อกครุภัณฑ์ที่แทงจำหน่ายแล้ว (`DISPOSAL`):**
   - หากเครื่องมีสถานะ `DISPOSAL` จะปฏิเสธการโอนย้ายทันที (`HTTP 400: Cannot transfer an asset that has been disposed`)
3. **บล็อกครุภัณฑ์ที่กำลังถูกยืมใช้งาน (`BORROWED`):**
   - เครื่องที่อยู่ระหว่างการยืมใช้งานต้องถูกส่งคืนเข้าคลังก่อน จึงจะสามารถทำเรื่องโอนย้ายได้ (`HTTP 400: Cannot transfer an asset that is currently borrowed`)
4. **บล็อกการโอนย้ายไปยังแผนกเดิม:**
   - แผนกปลายทาง (`to_section_id`) ต้องไม่ตรงกับแผนกปัจจุบัน (`HTTP 400: Target section must be different from current section`)
5. **ตรวจสอบการมีอยู่ของแผนกปลายทาง:**
   - แผนกปลายทางต้องมีอยู่จริงในระบบ (`HTTP 404: Target section not found`)
6. **การทำงานแบบ Atomic Transaction (`prisma.$transaction`):**
   - สร้างข้อมูลในตาราง `transfer`
   - อัปเดต `section_id` ของเครื่องในตาราง `asset` ให้เป็นแผนกใหม่พร้อมกันแบบ 100% หากเกิดข้อผิดพลาดจะ Rollback ทั้งหมด

---

## 📡 3. รายละเอียด API แต่ละเส้นทาง

### 📌 เส้นที่ 1: `POST /asset/:id/transfer` (บันทึกการโอนย้ายครุภัณฑ์แบบ Direct Transfer)

#### Path Parameter
- `:id` (UUID): รหัสครุภัณฑ์ที่ต้องการโอนย้าย

#### Request Body
```json
{
  "transferDocNo": "TF-2567-001",
  "transferDate": "2026-09-15T00:00:00.000Z",
  "to_section_id": "sec-icu-001",
  "toLocation": "อาคารเฉลิมพระเกียรติ ชั้น 3 ห้อง ICU-1",
  "fromLocation": "ศูนย์เครื่องมือแพทย์ ชั้น 1",
  "remark": "โอนย้ายถาวรเพื่อรองรับผู้ป่วยวิกฤตฉุกเฉินประจำหอผู้ป่วย ICU"
}
```

*หมายเหตุ: หน้าบ้านส่งเฉพาะเลขที่เอกสาร วันที่ และแผนกปลายทาง โดยระบบจะบันทึก `transferred_by` จากผู้ใช้งานที่ล็อกอินให้อัตโนมัติในเบื้องหลัง*

#### Response (`201 Created`)
```json
{
  "id": "e931448b-8255-4a52-9bf0-f8644558509c",
  "asset_id": "8f74e951-692a-43d9-95e5-3f32d8471bd8",
  "transferDocNo": "TF-2567-001",
  "transferDate": "2026-09-15T00:00:00.000Z",
  "from_section_id": "sec-med-center-01",
  "to_section_id": "sec-icu-001",
  "fromLocation": "ศูนย์เครื่องมือแพทย์ ชั้น 1",
  "toLocation": "อาคารเฉลิมพระเกียรติ ชั้น 3 ห้อง ICU-1",
  "transferred_by": "550e8400-e29b-41d4-a716-446655440001",
  "remark": "โอนย้ายถาวรเพื่อรองรับผู้ป่วยวิกฤตฉุกเฉินประจำหอผู้ป่วย ICU",
  "createdAt": "2026-09-12T16:20:00.000Z",
  "fromSection": {
    "id": "sec-med-center-01",
    "name": "ศูนย์เครื่องมือแพทย์"
  },
  "toSection": {
    "id": "sec-icu-001",
    "name": "หอผู้ป่วยวิกฤต (ICU)"
  },
  "transferredBy": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "employeeId": "EMP-0099",
    "firstname": "กานดา",
    "lastname": "พัสดุดี"
  }
}
```

---

### 📌 เส้นที่ 2: `GET /asset/:id/transfer` (ดูประวัติการโอนย้ายของครุภัณฑ์รายเครื่อง)

#### Path Parameter
- `:id` (UUID): รหัสครุภัณฑ์

#### Response (`200 OK`)
```json
[
  {
    "id": "e931448b-8255-4a52-9bf0-f8644558509c",
    "transferDocNo": "TF-2567-001",
    "transferDate": "2026-09-15T00:00:00.000Z",
    "fromLocation": "ศูนย์เครื่องมือแพทย์ ชั้น 1",
    "toLocation": "อาคารเฉลิมพระเกียรติ ชั้น 3 ห้อง ICU-1",
    "remark": "โอนย้ายถาวรเพื่อรองรับผู้ป่วยวิกฤตฉุกเฉินประจำหอผู้ป่วย ICU",
    "fromSection": {
      "id": "sec-med-center-01",
      "name": "ศูนย์เครื่องมือแพทย์"
    },
    "toSection": {
      "id": "sec-icu-001",
      "name": "หอผู้ป่วยวิกฤต (ICU)"
    },
    "transferredBy": {
      "id": "user-01",
      "employeeId": "EMP-0099",
      "firstname": "กานดา",
      "lastname": "พัสดุดี"
    }
  }
]
```

---

### 📌 เส้นที่ 3: `GET /asset/transfer` (หน้ารวมประวัติการโอนย้ายทั้งหมด)

#### Query Parameters
- `page`: หน้าที่ต้องการ (ค่าตั้งต้น: 1)
- `limit`: จำนวนแถวต่อหน้า (ค่าตั้งต้น: 20)
- `search`: ค้นหาจากเลขที่เอกสาร (`transferDocNo`), รหัสครุภัณฑ์ (`noid`), ชื่อเครื่อง, หรือชื่อแผนก

#### Response (`200 OK`)
```json
{
  "data": [
    {
      "id": "e931448b-8255-4a52-9bf0-f8644558509c",
      "transferDocNo": "TF-2567-001",
      "transferDate": "2026-09-15T00:00:00.000Z",
      "asset": {
        "id": "8f74e951-692a-43d9-95e5-3f32d8471bd8",
        "noid": "MD-67-001",
        "name": "เครื่องช่วยหายใจชนิดควบคุมด้วยปริมาตรและความดัน",
        "model": "Puritan Bennett 840"
      },
      "fromSection": { "name": "ศูนย์เครื่องมือแพทย์" },
      "toSection": { "name": "หอผู้ป่วยวิกฤต (ICU)" },
      "transferredBy": {
        "id": "user-01",
        "employeeId": "EMP-0099",
        "firstname": "กานดา",
        "lastname": "พัสดุดี"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## 💻 4. โค้ดตัวอย่างการต่อเชื่อมหน้าบ้าน (React / TypeScript Example)

```tsx
import React, { useState } from 'react';
import axios from 'axios';

interface TransferFormData {
  transferDocNo: string;
  transferDate: string;
  to_section_id: string;
  toLocation?: string;
  remark?: string;
}

export const TransferAssetModal = ({
  assetId,
  assetNoid,
  currentSectionName,
  isOpen,
  onClose,
  onSuccess,
}: {
  assetId: string;
  assetNoid: string;
  currentSectionName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [formData, setFormData] = useState<TransferFormData>({
    transferDocNo: '',
    transferDate: new Date().toISOString().split('T')[0],
    to_section_id: '',
    toLocation: '',
    remark: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await axios.post(`/asset/${assetId}/transfer`, {
        ...formData,
        transferDate: new Date(formData.transferDate).toISOString(),
      });
      alert('บันทึกการโอนย้ายครุภัณฑ์เรียบร้อยแล้ว');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการโอนย้าย');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border">
        <h3 className="text-base font-bold text-slate-900">
          📦 แบบฟอร์มโอนย้ายครุภัณฑ์ ({assetNoid})
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          แผนกต้นทางปัจจุบัน: <strong>{currentSectionName}</strong>
        </p>

        {error && (
          <div className="my-3 p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 mt-4 text-xs">
          <div>
            <label className="block font-medium mb-1">เลขที่เอกสารการโอนย้าย *</label>
            <input
              type="text"
              required
              placeholder="เช่น TF-2567-001"
              value={formData.transferDocNo}
              onChange={(e) => setFormData({ ...formData, transferDocNo: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">วันที่โอนย้าย *</label>
            <input
              type="date"
              required
              value={formData.transferDate}
              onChange={(e) => setFormData({ ...formData, transferDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">แผนกปลายทางที่รับโอน *</label>
            <select
              required
              value={formData.to_section_id}
              onChange={(e) => setFormData({ ...formData, to_section_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-white"
            >
              <option value="">-- เลือกแผนกปลายทาง --</option>
              <option value="sec-icu-01">หอผู้ป่วยวิกฤต (ICU)</option>
              <option value="sec-er-01">แผนกฉุกเฉิน (ER)</option>
              <option value="sec-med-center-01">ศูนย์เครื่องมือแพทย์</option>
            </select>
          </div>

          <div>
            <label className="block font-medium mb-1">สถานที่ปลายทาง (ห้อง/ชั้น/อาคาร)</label>
            <input
              type="text"
              placeholder="เช่น อาคาร 3 ชั้น 2 ห้อง ICU-1"
              value={formData.toLocation}
              onChange={(e) => setFormData({ ...formData, toLocation: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">เหตุผลการโอนย้าย</label>
            <textarea
              rows={2}
              placeholder="ระบุเหตุผลความจำเป็นในการโอนย้าย"
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกการโอนย้าย'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```
