# Asset, Availability and Borrow Status Rules

## Asset Status

| Status        | Description            |
| ------------- | ---------------------- |
| NORMAL        | ครุภัณฑ์อยู่ในสภาพปกติ |
| DAMAGED       | ครุภัณฑ์ชำรุด          |
| UNDER_REPAIR  | อยู่ระหว่างการซ่อม     |
| WAIT_DISPOSAL | อยู่ระหว่างรอจำหน่าย   |
| DISPOSAL      | จำหน่ายแล้ว            |
| LOST          | สูญหาย                 |

---

## Availability Status

| Status      | Description    |
| ----------- | -------------- |
| AVAILABLE   | พร้อมให้ยืม    |
| BORROWED    | ถูกยืมอยู่     |
| UNAVAILABLE | ไม่พร้อมให้ยืม |

---

## Borrow Status

| Status    | Description      |
| --------- | ---------------- |
| BORROWED  | กำลังยืมอยู่     |
| RETURNED  | คืนเรียบร้อยแล้ว |
| CANCELLED | ยกเลิกรายการยืม  |

---

# Asset Status Transition

```text
NORMAL
├──> DAMAGED
├──> WAIT_DISPOSAL
└──> LOST

DAMAGED
├──> UNDER_REPAIR
├──> WAIT_DISPOSAL
└──> LOST

UNDER_REPAIR
├──> NORMAL
├──> WAIT_DISPOSAL
└──> LOST

WAIT_DISPOSAL
└──> DISPOSAL

DISPOSAL
└──> END

LOST
└──> END
```

---

# Availability Status Transition

```text
AVAILABLE
├──> BORROWED
└──> UNAVAILABLE

BORROWED
└──> AVAILABLE

UNAVAILABLE
└──> AVAILABLE
```

---

# Borrow Status Transition

```text
BORROWED
├──> RETURNED
└──> CANCELLED

RETURNED
└──> END

CANCELLED
└──> END
```

---

# Business Rules

## Rule 1 : Asset Status controls Availability Status

เฉพาะครุภัณฑ์ที่มี Asset Status = `NORMAL` เท่านั้นที่สามารถมีสถานะ

```text
AVAILABLE
BORROWED
```

ได้

หาก Asset Status เป็น

* DAMAGED
* UNDER_REPAIR
* WAIT_DISPOSAL
* DISPOSAL
* LOST

Availability Status จะต้องเป็น

```text
UNAVAILABLE
```

---

## Rule 2 : Borrow Transaction

เมื่อมีการสร้างรายการยืมสำเร็จ

```text
Borrow Status
BORROWED

Availability Status
AVAILABLE -> BORROWED
```

Asset Status ไม่เปลี่ยน

---

## Rule 3 : Return Asset

เมื่อคืนครุภัณฑ์เรียบร้อย

```text
Borrow Status
BORROWED -> RETURNED
```

หากครุภัณฑ์ไม่มีการแจ้งชำรุด

```text
Availability Status
BORROWED -> AVAILABLE

Asset Status
NORMAL
```

---

## Rule 4 : Return with Damage

เมื่อคืนครุภัณฑ์และมีการแจ้งชำรุด

```text
Borrow Status
BORROWED -> RETURNED

Asset Status
NORMAL -> DAMAGED

Availability Status
BORROWED -> UNAVAILABLE
```

---

## Rule 5 : Send to Repair

เมื่อส่งซ่อม

```text
Asset Status
DAMAGED -> UNDER_REPAIR

Availability Status
UNAVAILABLE
```

---

## Rule 6 : Repair Completed

เมื่อซ่อมเสร็จ

```text
Asset Status
UNDER_REPAIR -> NORMAL

Availability Status
AVAILABLE
```

---

## Rule 7 : Waiting for Disposal

เมื่อปรับสถานะเป็นรอจำหน่าย

```text
Asset Status
NORMAL / DAMAGED / UNDER_REPAIR
    ->
WAIT_DISPOSAL

Availability Status
UNAVAILABLE
```

---

## Rule 8 : Disposal Completed

เมื่อจำหน่ายเสร็จ

```text
Asset Status
WAIT_DISPOSAL -> DISPOSAL

Availability Status
UNAVAILABLE
```

---

## Rule 9 : Asset Lost

เมื่อครุภัณฑ์สูญหาย

```text
Asset Status
NORMAL / DAMAGED / UNDER_REPAIR
    ->
LOST

Availability Status
UNAVAILABLE
```

---

# Validation Rules

* Asset Status ที่ไม่ใช่ `NORMAL` จะไม่สามารถมี Availability Status เป็น `AVAILABLE` หรือ `BORROWED`
* ครุภัณฑ์ที่มี Availability Status = `BORROWED` ต้องมี Borrow Transaction ที่มี Borrow Status = `BORROWED`
* Asset ที่มีสถานะ `DISPOSAL` หรือ `LOST` ไม่สามารถสร้างรายการยืมใหม่ได้
* การยืมสามารถเกิดขึ้นได้เฉพาะเมื่อ

  * Asset Status = `NORMAL`
  * Availability Status = `AVAILABLE`
