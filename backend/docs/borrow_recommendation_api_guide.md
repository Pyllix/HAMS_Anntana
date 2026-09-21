# 📘 คู่มือการใช้งาน API: Smart Asset Borrow Recommendation Engine
# (ระบบแนะนำครุภัณฑ์ในการยืมเพื่อกระจายภาระการใช้งาน)

เอกสารแนะนำการใช้งาน API ระบบแนะนำครุภัณฑ์ในการยืมและการตรวจสอบแจ้งเตือนสลับเครื่อง (**Balanced Usage Rotation & Smart Swap Nudge**) สำหรับนักพัฒนาหน้าบ้าน (Frontend), ผู้ดูแลระบบ (Admin) และเจ้าหน้าที่ศูนย์เครื่องมือแพทย์/พัสดุ (Asset Center & Parcel Staff)

---

## 🧭 1. ภาพรวมของ API (The Recommendation Endpoints)

| เส้นที่ | Method | Endpoint Path | หมวดหมู่ | วัตถุประสงค์และการใช้งานบนหน้าจอ |
| :---: | :---: | :--- | :---: | :--- |
| **1** | **`GET`** | `/borrowings/recommendations` | **Catalog Rotation** | **ดึงรายการครุภัณฑ์พร้อมป้ายแนะนำ 🌟:** ดึงรายการเครื่องรุ่นเดียวกันที่พร้อมใช้งาน จัดอันดับตามสูตรหมุนเวียน (วันใช้งานสะสมน้อยสุด $\rightarrow$ จอดพักนานสุด) |
| **2** | **`GET`** | `/borrowings/recommendations/swap-check` | **Smart Swap Nudge** | **กล่องแจ้งเตือนสลับเครื่อง:** ตรวจสอบว่าเครื่องที่ผู้ใช้กำลังจะกดยืม มีเครื่องรุ่นเดียวกันที่ว่างอยู่และ "จอดพักนานกว่า / ใช้งานน้อยกว่าอย่างมีนัยสำคัญ" หรือไม่ |

---

## 🧮 2. อัลกอริทึมการจัดอันดับและเกณฑ์การแจ้งเตือน (Algorithm & Rules)

### 2.1 Balanced Usage Rotation Hierarchy
ระบบคัดกรองเฉพาะเครื่องที่เป็นรุ่นเดียวกัน (`model` เดียวกัน) ที่มีสถานะ:
- `availabilityStatus = 'AVAILABLE'` (พร้อมให้ยืม)
- `assetStatus = 'NORMAL'` (สภาพปกติ ไม่ชำรุด/รอซ่อม/แทงจำหน่าย)

จัดอันดับตามลำดับความสำคัญ (Zero N+1 Query ผ่าน CTE):
1. **`usageDays90d` (ASC):** จำนวนวันใช้งานสุทธิในรอบ 90 วันล่าสุด (ยิ่งน้อยยิ่งได้อันดับดี)
2. **`idleDays` (DESC):** จำนวนวันที่จอดพักในคลังนับจากคืนล่าสุด (`return_date`) หรือวันที่รับมอบเครื่อง (`receive_date`) สำหรับเครื่องใหม่
3. **`borrowCount90d` (ASC):** จำนวนครั้งที่ถูกยืมในรอบ 90 วัน
4. **`noid` / `asset_id` (ASC):** จัดเรียงตามรหัสทะเบียนครุภัณฑ์แบบแน่นอน (Deterministic)

### 2.2 เกณฑ์การกระตุ้นสลับเครื่อง (Smart Swap Nudge Conditions)
เมื่อผู้ใช้เลือกเครื่อง $A$ ระบบจะแนะนำเครื่อง $B$ (`hasBetterAlternative = true`) เมื่อเข้าเงื่อนไขใดเงื่อนไขหนึ่งต่อไปนี้:
1. **เกณฑ์วันใช้งานสะสมต่างกัน:** `usageDays(A) - usageDays(B) >= 3` วัน (เครื่องสำรองผ่านการใช้งานน้อยกว่าอย่างน้อย 3 วัน)
2. **เกณฑ์การจอดพักเพื่อฟื้นฟูสภาพ:** `usageDays(A) >= 7` วัน **และ** `idleDays(B) - idleDays(A) >= 7` วัน (เครื่อง $A$ เพิ่งถูกคืนมา ในขณะที่เครื่อง $B$ จอดพักมารอนานกว่าเกิน 1 สัปดาห์)

---

## 📡 3. รายละเอียด API แต่ละเส้นทาง

### 📌 เส้นที่ 1: `GET /borrowings/recommendations` (ดึงรายการครุภัณฑ์จัดอันดับแนะนำ)

#### Query Parameters
| Parameter | Type | Required | Default | คำอธิบาย |
| :--- | :---: | :---: | :---: | :--- |
| `model` | `string` | No* | - | ชื่อรุ่นครุภัณฑ์ เช่น `Puritan Bennett 840` |
| `equipmentTypeId` | `number` | No* | - | รหัสประเภทเครื่องมือแพทย์ เช่น `1` |
| `assetId` | `UUID` | No* | - | รหัส UUID ของครุภัณฑ์อ้างอิง (ถ้าระบุ ระบบจะดึง `model` และ `equipmentTypeId` ให้โดยอัตโนมัติ) |
| `limit` | `number` | No | `10` | จำนวนรายการที่ต้องการแสดง (1 - 50) |

*\* แนะนำให้ส่ง `model` หรือ `assetId` อย่างใดอย่างหนึ่ง*

#### ตัวอย่าง Request
```http
GET /borrowings/recommendations?model=Puritan%20Bennett%20840&limit=5
Authorization: Bearer <token>
```

#### ตัวอย่าง Response (`200 OK`)
```json
{
  "model": "Puritan Bennett 840",
  "equipmentTypeId": 1,
  "totalAvailable": 3,
  "recommendedAssetId": "550e8400-e29b-41d4-a716-446655440003",
  "candidates": [
    {
      "assetId": "550e8400-e29b-41d4-a716-446655440003",
      "noid": "MD-67-003",
      "name": "เครื่องช่วยหายใจชนิดควบคุมด้วยปริมาตรและความดัน",
      "model": "Puritan Bennett 840",
      "serialNo": "SN-PB840-003",
      "sectionName": "ศูนย์เครื่องมือแพทย์",
      "imageUrl": "https://storage.hams.hospital/assets/pb840-03.jpg",
      "usageDays90d": 0.0,
      "idleDays": 45.2,
      "borrowCount90d": 0,
      "isRecommended": true,
      "recommendationReason": "🌟 แนะนำเครื่องนี้: ครุภัณฑ์ใหม่พร้อมใช้งาน ยังไม่มีประวัติการยืมในรอบ 90 วัน"
    },
    {
      "assetId": "550e8400-e29b-41d4-a716-446655440002",
      "noid": "MD-67-002",
      "name": "เครื่องช่วยหายใจชนิดควบคุมด้วยปริมาตรและความดัน",
      "model": "Puritan Bennett 840",
      "serialNo": "SN-PB840-002",
      "sectionName": "ศูนย์เครื่องมือแพทย์",
      "imageUrl": "https://storage.hams.hospital/assets/pb840-02.jpg",
      "usageDays90d": 12.5,
      "idleDays": 14.0,
      "borrowCount90d": 2,
      "isRecommended": false,
      "recommendationReason": ""
    },
    {
      "assetId": "550e8400-e29b-41d4-a716-446655440001",
      "noid": "MD-67-001",
      "name": "เครื่องช่วยหายใจชนิดควบคุมด้วยปริมาตรและความดัน",
      "model": "Puritan Bennett 840",
      "serialNo": "SN-PB840-001",
      "sectionName": "ศูนย์เครื่องมือแพทย์",
      "imageUrl": "https://storage.hams.hospital/assets/pb840-01.jpg",
      "usageDays90d": 38.0,
      "idleDays": 2.5,
      "borrowCount90d": 6,
      "isRecommended": false,
      "recommendationReason": ""
    }
  ]
}
```

---

### 📌 เส้นที่ 2: `GET /borrowings/recommendations/swap-check` (ตรวจสอบแจ้งเตือนสลับเครื่อง)

#### Query Parameters
| Parameter | Type | Required | คำอธิบาย |
| :--- | :---: | :---: | :--- |
| `assetId` | `UUID` | **Yes** | รหัส UUID ของครุภัณฑ์ที่ผู้ใช้กำลังคลิกเลือกเพื่อขอยืม |

#### ตัวอย่าง Request
```http
GET /borrowings/recommendations/swap-check?assetId=550e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <token>
```

#### ตัวอย่าง Response 1: มีเครื่องสำรองที่ดีกว่าชัดเจน (`hasBetterAlternative = true`)
```json
{
  "selectedAsset": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "noid": "MD-67-001",
    "usageDays90d": 38.0,
    "idleDays": 2.5
  },
  "hasBetterAlternative": true,
  "recommendedAsset": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "noid": "MD-67-003",
    "name": "เครื่องช่วยหายใจชนิดควบคุมด้วยปริมาตรและความดัน",
    "model": "Puritan Bennett 840",
    "usageDays90d": 0.0,
    "idleDays": 45.2,
    "daysUsageDifference": 38.0,
    "nudgeReason": "💡 พบเครื่องรุ่นเดียวกัน (หมายเลข MD-67-003) จอดพักมาแล้ว 45 วัน (ผ่านการใช้งานน้อยกว่าเครื่องนี้ 38 วัน) คุณต้องการสลับใช้เครื่องที่แนะนำเพื่อกระจายการใช้งานหรือไม่?"
  }
}
```

#### ตัวอย่าง Response 2: เครื่องที่เลือกเหมาะสมดีอยู่แล้ว หรือไม่มีเครื่องอื่นว่าง (`hasBetterAlternative = false`)
```json
{
  "selectedAsset": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "noid": "MD-67-003",
    "usageDays90d": 0.0,
    "idleDays": 45.2
  },
  "hasBetterAlternative": false,
  "recommendedAsset": null
}
```

---

## 💻 4. โค้ดตัวอย่างการต่อเชื่อมฝั่ง Frontend (React / TypeScript Integration)

### 4.1 กล่องแจ้งเตือนสลับเครื่อง (Smart Swap Nudge Alert)
เมื่อผู้ใช้กดเลือกเครื่องในฟอร์มขอยืมครุภัณฑ์:

```tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface SwapCheckResult {
  hasBetterAlternative: boolean;
  selectedAsset: { id: string; noid: string | null };
  recommendedAsset?: {
    id: string;
    noid: string | null;
    model: string;
    idleDays: number;
    daysUsageDifference: number;
    nudgeReason: string;
  } | null;
}

export const BorrowSelectionWithSwapCheck = ({
  selectedAssetId,
  onSelectAsset,
}: {
  selectedAssetId: string;
  onSelectAsset: (assetId: string) => void;
}) => {
  const [swapData, setSwapData] = useState<SwapCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!selectedAssetId) return;

    let isMounted = true;
    setIsChecking(true);

    axios
      .get<SwapCheckResult>(`/borrowings/recommendations/swap-check`, {
        params: { assetId: selectedAssetId },
      })
      .then((res) => {
        if (isMounted) setSwapData(res.data);
      })
      .catch((err) => console.error('Error checking swap alternative:', err))
      .finally(() => {
        if (isMounted) setIsChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedAssetId]);

  if (!swapData?.hasBetterAlternative || !swapData.recommendedAsset) {
    return null;
  }

  const { recommendedAsset } = swapData;

  return (
    <div className="my-3 p-4 bg-amber-50 border border-amber-300 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn">
      <div className="flex items-start gap-3">
        <span className="text-2xl">💡</span>
        <div>
          <h4 className="font-semibold text-amber-900 text-sm">
            คำแนะนำเพื่อกระจายการใช้งาน (Usage Rotation)
          </h4>
          <p className="text-amber-800 text-xs mt-0.5">
            {recommendedAsset.nudgeReason}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
        <button
          type="button"
          onClick={() => onSelectAsset(recommendedAsset.id)}
          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-md shadow-sm transition-colors flex items-center gap-1"
        >
          🔄 สลับใช้เครื่องนี้ ({recommendedAsset.noid || recommendedAsset.model})
        </button>
      </div>
    </div>
  );
};
```

### 4.2 ป้ายกำกับเครื่องแนะนำในตารางแคตตาล็อก (Catalog Recommendation Badge)
```tsx
{candidate.isRecommended && (
  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
    🌟 แนะนำสำหรับการยืม
  </span>
)}
```

---

## 🔒 5. สิทธิ์การเข้าถึง (RBAC Roles)
ทั้งสอง Endpoint เปิดให้สิทธิ์กลุ่มผู้ใช้ที่เกี่ยวข้องกับวงจรการยืมใช้งาน:
- `ADMIN`: ดูและทดสอบได้ทุกแผนก
- `MANAGER`: ผู้บริหารและหัวหน้าศูนย์เครื่องมือแพทย์
- `ASSET_CENTER_STAFF`: เจ้าหน้าที่ศูนย์เครื่องมือแพทย์ (ผู้จัดเตรียมและจ่ายเครื่อง)
- `PARCEL_STAFF`: เจ้าหน้าที่งานพัสดุ
- `DEPARTMENT_STAFF`: เจ้าหน้าที่ประจำหอผู้ป่วย/วอร์ด (ผู้ยืมใช้งาน)
