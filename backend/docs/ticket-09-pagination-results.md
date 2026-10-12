# Ticket 09 — ผลการย้าย pagination, summary และ refresh

ตรวจวันที่ 2026-10-12; รายงานครอบคลุมงาน API ของ Ticket 08 และ pagination/summary/refresh ของ Ticket 09

## สิ่งที่เปลี่ยน

- ตารางขอข้อมูลเฉพาะหน้าที่ใช้จาก BE ขนาด 20 แถว; asset-stock/equipment-stock คง 10 แถวเดิม ใช้ meta.total/totalPages จริง
- ค้นหา debounce 300 ms; ส่งสถานะ ประเภท แผนก แหล่งอะไหล่ role/banned และวันที่ไปกรองก่อนแบ่งหน้า เปลี่ยนเงื่อนไขแล้วกลับหน้าแรก
- กล่องสรุปและ badge อ่านยอดรวมจาก summary หรือ metadata ของคิว; สถานะที่ไม่มี key หลังโหลดสำเร็จแสดง 0 และระหว่างโหลด/ผิดพลาดแสดง — ไม่คำนวณจากแถวหน้าเดียวและไม่มี badge 999
- งานซ่อม/คิวอนุมัติใช้ list projection; เปิด detail เฉพาะตอนใช้งาน ไม่วนอ่านรายละเอียดทุกงานตอนเปิดตาราง
- ตัวเลือกอะไหล่ค้นหา/เปลี่ยนหน้าและรักษาค่าที่เลือกนอกหน้าปัจจุบัน; ราคาที่ผู้ใช้แก้เองไม่ถูก refresh ทับ
- local drafts แสดงแยกจากรายการ BE พร้อม detail/actions เดิม ไม่เพิ่ม summary/total ของข้อมูลจริง
- refresh เฉพาะ query families ที่ได้รับผล: cancel read เก่าก่อน invalidate ทั้ง cold/warm cache หลัง write สำเร็จ; coalesce event 100 ms
- query key ผูก user/scope/page/filter; ส่ง AbortSignal, หยุด polling เมื่อซ่อนแท็บ/ออกหน้า/logout และคงแถวเดิมเมื่อ background refresh ผิดพลาด

## BE ที่เสริมตามการอนุญาต

Repair assignmentScope MINE/MINE_OR_UNASSIGNED, evaluatedOnly=false และ assetTypeId; stock-in groupId และ group projection/search ทั้ง Prisma/SQL paths; repair/borrow model/serial/full-name และรหัส REQ/OUT ที่ UI แสดงค้นหาได้จากรหัส REP เดิม

ผู้ใช้อนุญาตเพิ่ม MAINTENANCE_HEAD เฉพาะ GET /spare-parts เพื่อเลือกอะไหล่ขณะประเมินงานซ่อม. PostgreSQL E2E ตรวจอ่านได้ 200 แต่ create/stock-in/PATCH/DELETE ยัง 403; DEPARTMENT_STAFF ยังอ่านรายการนี้ไม่ได้. ไม่เปลี่ยนสิทธิ์ summary/detail/history ของอะไหล่จากขอบเขตนี้

## Browser/API matrix

Playwright ใช้ Microsoft Edge กับ Nest API/guards/session/2FA จริงและ PostgreSQL 17 แยกชั่วคราว ไม่ใช้ข้อมูลจริงและไม่แก้ฐานข้อมูล local ที่ผู้ใช้ใช้งาน. Fixture: 800 assets, 5,000 borrows (8 สถานะ สถานะละ 625), 1,800 repair jobs (6 กลุ่ม กลุ่มละ 300), 650 spare parts, 2,200 stock-ins (2,178 active), 1,000 users บวกบัญชีทดสอบ

ทุก route/แท็บด้านล่างเปิดจริงและไม่มี render/API-list error. ท่อง API ทุกหน้าของแต่ละ scope แล้วจำนวนและ ID ไม่ซ้ำตรง meta.total; limit=100 ใช้เฉพาะ verification traversal ส่วน UI 10/20. ปุ่มเลขหน้า 2 ตรวจผ่านเมื่อหน้านั้นมีปุ่มตัวเลข; คิวที่ใช้ปุ่มลูกศรตรวจ completeness ผ่าน API และ browser แถวปัจจุบัน. เปลี่ยนหน้าตารางไม่ขอ summary ใหม่

| Route / แท็บ | Role | แถวที่แสดง | Exact total | IDs ตรวจครบ | Refresh | ผล |
|---|---|---:|---:|---:|---|---|
| borrow-return-assets_center | ASSET_CENTER_STAFF | 20 | 800 | 800 | 30 วินาที foreground | ผ่าน |
| borrow-return-assets_center / อนุมัติคำขอยืม | ASSET_CENTER_STAFF | 20 | 625 | 625 | 30 วินาที foreground | ผ่าน |
| borrow-return-assets_center / รับคืนครุภัณฑ์ | ASSET_CENTER_STAFF | 20 | 625 | 625 | 30 วินาที foreground | ผ่าน |
| borrow-history | ASSET_CENTER_STAFF | 20 | 5000 | 5000 | หลังบันทึก/focus/manual | ผ่าน |
| borrow-request | DEPARTMENT_STAFF | 20 | 320 | 320 | 30 วินาที foreground | ผ่าน |
| borrow-request / คืนครุภัณฑ์ | DEPARTMENT_STAFF | 20 | 3125 | 3125 | 30 วินาที foreground | ผ่าน |
| accept-work | MAINTENANCE_HEAD | 20 | 300 | 300 | 30 วินาที foreground | ผ่าน |
| accept-work / รายการงานซ่อม | MAINTENANCE_HEAD | 20 | 1500 | 1500 | 30 วินาที foreground | ผ่าน |
| accept-work / ยืนยันการซ่อม | MAINTENANCE_HEAD | 20 | 600 | 600 | 30 วินาที foreground | ผ่าน |
| track-status | ASSET_CENTER_STAFF | 20 | 1800 | 1800 | 30 วินาที foreground | ผ่าน |
| track-status | DEPARTMENT_STAFF | 20 | 1800 | 1800 | 30 วินาที foreground | ผ่าน |
| part-stock | PARCEL_STAFF | 20 | 650 | 650 | 30 วินาที foreground | ผ่าน |
| order-spare-parts | PARCEL_STAFF | 20 | 2178 | 2178 | หลังบันทึก/focus/manual | ผ่าน |
| spare-part-approvals | PARCEL_STAFF | 20 | 300 | 300 | 30 วินาที foreground | ผ่าน |
| outsource-approvals | PARCEL_STAFF | 20 | 300 | 300 | 30 วินาที foreground | ผ่าน |
| unrepairable-receipts | PARCEL_STAFF | 20 | 300 | 300 | 30 วินาที foreground | ผ่าน |
| parcel-repair-operations | PARCEL_STAFF | 20 | 300 | 300 | 30 วินาที foreground | ผ่าน |
| parcel-repair-operations / อนุมัติเบิกอะไหล่ | PARCEL_STAFF | 20 | 300 | 300 | 30 วินาที foreground | ผ่าน |
| parcel-repair-operations / อนุมัติส่งซ่อมภายนอก | PARCEL_STAFF | 20 | 300 | 300 | 30 วินาที foreground | ผ่าน |
| user-management | ADMIN | 20 | 1007 | 1007 | หลังบันทึก/focus/manual | ผ่าน |
| asset-stock | DEPARTMENT_STAFF | 10 | 800 | 800 | 30 วินาที foreground | ผ่าน |
| equipment-stock | PARCEL_STAFF | 10 | 800 | 800 | 30 วินาที foreground | ผ่าน |
| parcel-equipment-stock | PARCEL_STAFF | 10 | 800 | 800 | 30 วินาที foreground | ผ่าน |
| asset-viability | PARCEL_STAFF | เดิม | 560 | เดิม | หลังบันทึก/focus/manual | ผ่าน |

Browser summary-cards audit ผ่านทั้ง 42 กล่องไม่ซ้ำ และ 6 badge; ทั้ง role tracking และ equipment alias ตรวจเพิ่ม รวม 54 card assertions. Scope filters/summary definitions รายหน้าอ้างอิง [contract 08](ticket-08-api-contract.md) และ inventory ใน .scratch/db-query-optimization/summary-inventory.md. หน้า viability ใช้ contract เดิม ไม่บังคับใช้ hook ใหม่หรือ polling; AssetStock/EquipmentStock เป็น live asset queries

## Summary semantics และ regression

กล่องประวัติยืม “รอดำเนินการ” = PENDING_APPROVE + APPROVED เท่านั้น. “กำลังยืม” รวม BORROWED/PENDING_RETURN/IN_PICKUP และรองรับ legacy PENDING_VERIFICATION; กล่องที่คืนแล้วรองรับ RETURNED และ legacy condition aliases. ไม่เพิ่มสถานะคืนเข้า pending

ตรวจ archive tabs WAIT_DISPOSAL/DISPOSAL/LOST ทั้ง equipment-stock และ alias: สถานะละ 120 รายการ เลือกวันจริงเหลือ 60 รายการ/6 หน้า/10 แถว และยอดกล่องรวมยัง 120. ใช้ updatedAt ตาม timezone ของ browser ทั้งวัน 00:00–23:59:59.999; test เดือนตรวจขอบเดือนด้วย. Fixture matrix รุ่นแรกใช้ DISPOSED ผิดจาก seed; รอบสุดท้ายและ regression เปลี่ยนเป็น DISPOSAL แล้ว

ตรวจ my-section NORMAL/DAMAGED filters และ users PARCEL_STAFF+banned (125 รายการ) ก่อนแบ่งหน้า, source INTERNAL/EXTERNAL (150 แต่ละกลุ่ม)/MIXED (0), อะไหล่หลัง 100 ทั้ง STAFF/HEAD และ stock-in picker, local draft/detail, focus/background error, logout และคำขอเก่าระหว่าง write

Lifecycle 7 กรณีไม่ซ้ำ: อีก session stock-in แล้วเห็นผลในรอบ poll 30 วินาทีจริง; simulated document visibility หยุด request 32 วินาทีและ focus refresh; search หลัง 100/reset/debounce; 500 คงแถวเดิม+แจ้ง stale; selection650/ราคา123.45 ส่ง stock-in จริง; 503 แสดง local draft แยกและเปิด detail; ออกหน้าหยุด poll 32 วินาที. การซ่อนแท็บใช้จำลอง visibility event ไม่ใช่สลับหน้าต่าง OS

## ผลตรวจอัตโนมัติ

- FE typecheck และ test typecheck ผ่าน
- FE tests 73/73 ผ่าน (รวม real QueryClient cold-cache race)
- FE production build ผ่าน; ยังมี warning ขนาด bundle ประมาณ 1.64 MB ไม่ได้ทำ code splitting ใน ticket นี้
- BE unit tests 468/468, 52 suites ผ่าน (runInBand, timeout 15s, forceExit เพราะยังมี async handles ของชุดเดิม)
- PostgreSQL API E2E 27/27, 2 suites ผ่าน: pagination/filter/summary/workload/write flows/authorization
- Browser matrix 24/24 ผ่าน; lifecycle 7 กรณีไม่ซ้ำผ่าน; regression 11/11 ผ่าน รวม cold/warm-cache race และอ่านค่าบนจอครบ 42 กล่อง/6 badge (54 card assertions เมื่อรวม route/role ที่ซ้ำ)
- BE typecheck/production build ผ่าน. ตรวจยืนยันใหม่เมื่อ 2026-10-12: TypeScript ตรวจผ่านและ Nest production build ผ่านเมื่อรันนอก sandbox โดยไม่แก้ source หรือ dependency. 4 errors ที่รายงานก่อนหน้าเกิดเฉพาะการรันใน sandbox ของเครื่องมือ (การ resolve/access dependency ต่างกัน); เทียบ compiler/โค้ดเดียวกันและปิด incremental cacheแล้ว ยืนยันว่าไม่ใช่ข้อผิดพลาดของโค้ดที่ต้องแก้

## Before/after

เทียบ FE snapshot ก่อน 09 กับ FE ปัจจุบันบน API ปัจจุบัน/ข้อมูลชุดเดียวกัน. รวม session/reference requests, response bytes ไม่รวม static files. หนึ่ง cold load ต่อกรณีบน Vite dev; เวลาเปิดหน้าได้รับผลจาก compilation และไม่ใช่ production benchmark. หน้าที่เดิมโหลดเพียง 100 อาจแสดงข้อมูลไม่ครบ จึงไม่อ้างว่าพฤติกรรมก่อนหน้าเทียบ correctness ได้โดยตรง. เกณฑ์ตรวจคือข้อมูลครบ, หน้าเล็กตามกำหนด, ไม่ bulk/detail-loop, ไม่เพิ่มความผิดพลาด; ไม่มีการตั้งเกณฑ์เปอร์เซ็นต์ latency ย้อนหลัง

| Route / แท็บ | คำขอ API ก่อน → หลัง | Bytes ก่อน → หลัง | ลด bytes | Dev ready ms ก่อน → หลัง |
|---|---:|---:|---:|---:|
| borrow-return-assets_center | 18 → 9 | 2,282,551 → 40,622 | 98.2% | 9625 → 575 |
| borrow-request | 14 → 8 | 1,525,032 → 44,601 | 97.1% | 437 → 471 |
| borrow-history | 5 → 6 | 192,143 → 40,190 | 79.1% | 513 → 513 |
| accept-work | 5 → 5 | 105,408 → 77,866 | 26.1% | 619 → 883 |
| accept-work / รายการงานซ่อม | 1524 → 7 | 23,967,878 → 129,171 | 99.5% | 13616 → 724 |
| accept-work / ยืนยันการซ่อม | 612 → 6 | 9,556,857 → 142,173 | 98.5% | 5715 → 663 |
| track-status | 7 → 8 | 521,400 → 115,443 | 77.9% | 565 → 540 |
| part-stock | 6 → 7 | 35,475 → 9,438 | 73.4% | 673 → 617 |
| order-spare-parts | 7 → 6 | 88,375 → 13,425 | 84.8% | 501 → 568 |
| spare-part-approvals | 307 → 5 | 4,783,154 → 139,624 | 97.1% | 3287 → 526 |
| outsource-approvals | 307 → 5 | 4,286,628 → 128,461 | 97.0% | 3366 → 511 |
| unrepairable-receipts | 307 → 6 | 4,198,259 → 123,192 | 97.1% | 2655 → 505 |
| user-management | 16 → 6 | 431,491 → 10,433 | 97.6% | 812 → 611 |
| asset-stock | 10 → 8 | 25,979 → 21,125 | 18.7% | 523 → 536 |
| equipment-stock | 13 → 8 | 31,121 → 21,163 | 32.0% | 513 → 481 |

บางหน้าขอเพิ่ม summary หนึ่งครั้งแต่ bytes ลดลง; ไม่อ้างว่า request count/เวลาเร็วขึ้นทุกหน้า. ตัวเลขนี้มุ่งพิสูจน์การลด bulk fetch ไม่รวมผล optimize SQL ของ tickets ก่อนหน้า

## Helpers ที่คงไว้

getAssets แบบอ่านครบยังใช้เมื่อเปิด recommendation modal ใน assetsTable/AvailableAssetsTable เท่านั้น เพื่อคงความหมายของ pool เดิม; เปิดตารางไม่เรียก bulk pool. ไม่เปลี่ยน helper ที่ผู้เรียกยังใช้ให้คืนเพียงหน้าแรก. assessmentService.getSpareParts, sparepartService.getSpareParts, repairHistoryService.getRepairHistory, partOrderService.getPartOrders และ approval bulk helpers เดิมคง compatibility; ตารางใน scope เปลี่ยนมาใช้ paged API แล้ว. Bounded references (groups/statuses/types/sections) คงตาม contract 08 ไม่เพิ่ม pagination โดยไม่มีความจำเป็น

## หลักฐาน

ไฟล์ diagnostics/scripts อยู่ใน .scratch ซึ่ง ignored และไม่ commit: diagnostics/2026-10-12/ticket-09/browser/{results.json,lifecycle.json,regression.json,summary-cards.json,before-after.json} และ screenshots รายหน้า; API output เก็บที่ ticket-09/api-e2e-output.txt. Review เทียบ FE snapshot ก่อน ticket09; BE08 เป็นงานค้างก่อนหน้า แยก review เฉพาะ hunks 09. Standards/Spec review ทำแยกสอง agent; findings ด้าน date fixtures และ read/write races แก้แล้วและตรวจยืนยันผ่าน ไม่มี blocker เหลือ

## ข้อจำกัดที่ยังคงอยู่

ยังใช้ number/offset pagination: ระหว่างผู้ใช้เปลี่ยนข้อมูลพร้อมกับเปลี่ยนหน้ารายการ อาจขยับตำแหน่งแถวได้ ไม่ใช่ snapshot ทั้งชุดหรือ cursor pagination. ตรวจความครบ/ไม่ซ้ำด้วยข้อมูลคงที่ และ refresh ให้เป็นปัจจุบันหลัง write/focus/poll; BE ยังคงต้องตรวจสถานะล่าสุดก่อนบันทึก. Recommendation modal ยังโหลด pool ครบเมื่อเปิดตาม behavior เดิม; ไม่รวมเป็นการลด bulk ของ modalนั้น. Customer UAT ยังเป็นขั้นตอนถัดไป ไม่แทนที่ด้วยชุดทดสอบสังเคราะห์

## แก้ไขข้อสรุปเรื่อง build — 2026-10-12

ตรวจยืนยันใหม่เมื่อ 2026-10-12: TypeScript ตรวจผ่านและ Nest production build ผ่านเมื่อรันนอก sandbox โดยไม่แก้ source หรือ dependency. 4 errors ที่รายงานก่อนหน้าเกิดเฉพาะการรันใน sandbox ของเครื่องมือ (การ resolve/access dependency ต่างกัน); เทียบ compiler/โค้ดเดียวกันและปิด incremental cacheแล้ว ยืนยันว่าไม่ใช่ข้อผิดพลาดของโค้ดที่ต้องแก้. ข้อสรุปก่อนหน้าว่าเป็น “errors เดิมของโค้ด” ไม่มีหลักฐานเพียงพอและถูกถอนแล้ว. ไฟล์ acq-type/budget-type/auth/image-upload, package manifest/lock และ tsconfig ไม่ต่างจาก HEAD; ไม่ต้องแก้ instanceof หรือเปลี่ยน Prisma adapter เพื่อแก้ผลตรวจนี้
