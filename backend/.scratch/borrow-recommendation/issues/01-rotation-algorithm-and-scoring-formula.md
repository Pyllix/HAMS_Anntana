# Rotation Algorithm and Scoring Formula

Type: grilling
Status: resolved
Blocked by: none

## Question

What is the exact mathematical scoring formula for Balanced Usage Rotation (weighting of 90-day borrowed days vs idle days since last return), edge-case handling (new asset never borrowed before, missing `return_date`, negative idle days from clock skew), and the human-readable Thai recommendation reason strings returned to borrowers?

## Answer

### 1. Balanced Usage Rotation Hierarchy

For all candidate assets matching the requested `model` (and `equipment_type_id`) that are `AVAILABLE` and `NORMAL`:

- **Rank 1 (Primary Key - Ascending):** `usageDays90d`  
  Total days borrowed across transactions in the rolling 90-day window. Lowest usage gets highest priority.
- **Rank 2 (Secondary Key - Descending):** `idleDays`  
  Days since last return (`now - lastReturnDate`). In case of a tie in usage days, the machine that has been idle/rested the longest is chosen first. (For brand new assets never borrowed, `idleDays` is computed from `receiveDate`).
- **Rank 3 (Tertiary Key - Ascending):** `borrowCount90d`  
  Total number of borrow transactions in 90 days.
- **Rank 4 (Final Tie-breaker - Ascending):** `asset.noid` / `asset.id`  
  Guarantees deterministic, stable ordering.

---

### 2. Smart Swap Nudge Threshold

An alternative available asset $B$ triggers a **Smart Swap Nudge** against user-selected asset $A$ if:
1. `assetB.usageDays90d <= assetA.usageDays90d - 3` (Asset B has at least 3 fewer days of usage), OR
2. `assetA.usageDays90d >= 7` AND `assetB.idleDays >= assetA.idleDays + 7` (Asset A was recently returned while Asset B has rested for over a week longer).

---

### 3. Explainable Thai Reason Messages

- Top Recommendation: *"🌟 แนะนำเครื่องนี้: ผ่านการใช้งานเพียง X วันในรอบ 90 วัน และจอดพักมาแล้ว Y วัน เหมาะสำหรับการหมุนเวียนใช้งาน"*
- New Asset: *"🌟 แนะนำเครื่องนี้: ครุภัณฑ์ใหม่พร้อมใช้งาน ยังไม่มีประวัติการยืมในรอบ 90 วัน"*
- Smart Swap Nudge: *"💡 พบเครื่องรุ่นเดียวกัน (หมายเลข [noid]) จอดพักมาแล้ว [Y] วัน (ผ่านการใช้งานน้อยกว่าเครื่องนี้ [Z] วัน) คุณต้องการสลับใช้เครื่องที่แนะนำเพื่อกระจายการใช้งานหรือไม่?"*

