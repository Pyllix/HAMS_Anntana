# Viability Rule Tree & Edge Cases

Type: grilling
Status: resolved
Blocked by: none

## Question

What are the exact threshold boundaries, calculation formulas, edge-case handling (e.g., zero purchase price `price === 0` from donations or building-attached assets, missing/future `receivedDate`, assets under active warranty, or missing `useful_life`), and the exact human-readable Thai reason messages returned for each status (`VIABLE`, `WARNING`, `UNVIABLE`) in the Rule-based Decision Tree?

## Answer

### 1. Decision Hierarchy & Threshold Rules (Precedence Order)

The Rule-based Decision Tree evaluates an asset using strict priority order:

1. **Active Warranty Check:**
   - Condition: `asset.warrantyDate !== null && new Date(asset.warrantyDate) > now`
   - Result: `VIABLE`
   - Reason: *"ครุภัณฑ์ยังอยู่ในระยะรับประกันการใช้งาน (สิ้นสุดวันที่ DD/MM/YYYY)"*

2. **Critical Cumulative Cost Ratio ($\ge 70\%$):**
   - Condition: `price > 0 && (cumulativeRepairCost / price) >= 0.70`
   - Result: `UNVIABLE`
   - Reason: *"ค่าซ่อมสะสม (฿X,XXX) คิดเป็น XX.X% ของราคาจัดซื้อ ซึ่งเกินเกณฑ์ร้อยละ 70 ตามระเบียบพัสดุ"*

3. **Expired Useful Life AND High Cost Ratio ($\ge 50\%$) OR Frequent Repair ($\ge 3$ times):**
   - Condition: `ageInYears >= usefulLifeYears && ((price > 0 && (cumulativeRepairCost / price) >= 0.50) || repairCount >= 3)`
   - Result: `UNVIABLE`
   - Reason: *"ครุภัณฑ์ใช้งานมาแล้ว X.X ปี (เกินอายุขัยมาตรฐาน X ปี) และมีค่าซ่อมสะสมเกินร้อยละ 50 หรือส่งซ่อมซ้ำซาก"*

4. **Zero-Price Assets (Donations/Building attachments) with Expired Life & Excessive Breakdown:**
   - Condition: `price <= 0 && ageInYears >= usefulLifeYears && repairCount >= 3`
   - Result: `UNVIABLE`
   - Reason: *"ครุภัณฑ์ไม่มีราคาจัดซื้อ (บริจาค/โอนย้าย) ใช้งานเกินอายุขัยมาตรฐาน (X.X ปี) และมีประวัติส่งซ่อมซ้ำซากเกินเกณฑ์"*

5. **Warning Thresholds (Cost Ratio $50\% - 70\%$, OR Expired Useful Life, OR High Recent Frequency):**
   - Condition:
     - If `price > 0 && (cumulativeRepairCost / price) >= 0.50`:
       - Result: `WARNING`
       - Reason: *"ค่าซ่อมสะสมคิดเป็น XX.X% ของราคาจัดซื้อ (เข้าข่ายเฝ้าระวังช่วง 50–70%)"*
     - Else if `ageInYears >= usefulLifeYears`:
       - Result: `WARNING`
       - Reason: *"ครุภัณฑ์ใช้งานมาแล้ว X.X ปี ซึ่งครบอายุขัยมาตรฐาน (X ปี) ควรเฝ้าระวังความคุ้มค่าในการซ่อมครั้งต่อไป"*
     - Else if `repairCountPastYear >= 3`:
       - Result: `WARNING`
       - Reason: *"ส่งซ่อมถี่ผิดปกติ (X ครั้งในรอบ 12 เดือนล่าสุด)"*

6. **Default Viable:**
   - Condition: Does not trigger any of the above rules.
   - Result: `VIABLE`
   - Reason: *"ค่าซ่อมสะสมและอายุการใช้งานอยู่ในเกณฑ์คุ้มค่าต่อการซ่อมบำรุง"*

---

### 2. Edge Case Handling Matrix

| Edge Case | Data Condition | Handling Behavior |
| :--- | :--- | :--- |
| Zero / Negative Purchase Price | `price <= 0` | Set `costRatio = null`, display badge "ไม่ระบุราคาซื้อ (บริจาค/แถม/ติดอาคาร)". Viability is assessed based on **Useful Life** and **Repair Frequency**. |
| Active Warranty | `warrantyDate > now` | Forced to `VIABLE`. Covered under warranty terms. |
| Missing Useful Life | `useful_life <= 0` or `null` | Use standard hospital fallback useful life: **8 years** (96 months). Set `isDefaultUsefulLife: true`. |
| Missing or Future Received Date | `receivedDate > now` or `null` | Future date is clamped to 0 days old. Null fallback to `createdAt`. |
| Zero Repair History | `repairCount === 0` | Forced to `VIABLE` with 0% cost ratio. |

