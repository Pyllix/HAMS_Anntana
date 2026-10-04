# 05 — BE: ตรวจครบและส่งมอบ Backend Contract ให้ FE

**What to build:** BE ของ feature รูป asset/user พร้อมส่งมอบตาม contract ที่ตรวจสอบได้ มี API/error/configuration/test evidence ครบ และมีแผน transition ที่อนุมัติสำหรับพัฒนา/ทดสอบ FE ในระบบแยก โดย G4 ยังขวาง production activation เพื่อให้ FE เริ่มได้โดยไม่มี required BE behavior ไปซ่อนใน tickets หน้าจอ

**Blocked by:** [03 — BE: เปิดดูรูปและกำหนด Read/Cache Contract](03-be-image-read-and-cache-contract.md); [04 — BE: ล้างรูปค้างและรูปเก่า พร้อมกู้หลัง Restart](04-be-image-cleanup-and-recovery.md). งาน 01–02 ต้อง complete ผ่าน dependencies ก่อนหน้าแล้วด้วย

**Owner / change boundary:** Backend integration/regression, compatibility review, configuration และ FE handoff; ยังไม่แก้ FE ไม่ตัดสินรอจำหน่ายแทนทีม และไม่ถือการเขียน ticket เป็น authorization ให้ mutate production

**Status:** complete — 2026-10-04; G5 ready for isolated FE development/acceptance. G4 remains open for production release.

**Verification:** [the handoff baseline](../../../docs/image-backend-handoff.md) records Backend build/TypeScript, 450/450 unit tests, fresh-DB image HTTP 17/17, asset-status regression 18/18, and focused live Cloudinary G3 replay/deletion 1/1 passing on 2026-10-04. All 29 migrations applied and temporary database containers were removed. The repaired status-test dependency changed no production behavior. Earlier G1/G2 live evidence is retained. The user's instruction to proceed with the recommended Ticket 05 summary on 2026-10-04 approves G2 direct-browser no-store retrieval and the separation of isolated FE work from production activation, recorded in [ADR 0005](../../../docs/adr/0005-employee-photo-cache-and-isolated-fe-handoff.md). G1–G3 are complete and G5 permits 06/07 in the isolated environment. Actual Frontend helper/lifecycle acceptance remains 06/07. G4 stays open because the deferred Base64 wait-disposal write conflicts with managed Asset images; production activation requires later resolution. No compatibility exception or wait-disposal change is authorized.

**Source spec:** [Image upload storage specification](../spec.md) — Implementation Decisions 9; Testing Decisions/G1–G5; Out of Scope.

## Acceptance criteria

- [x] ตรวจ 01–04 complete จริงทั้งพฤติกรรมและ evidence ของ G1–G3 ไม่มี required BE behavior ที่จะไปทำใน 06/07 และไม่ถือ skipped dedicated-DB/live-provider suites ว่า pass
- [x] ทดสอบ API flow รวม upload→verify→create/claim→read→replace→cleanup พร้อม auth/CSRF/session/2FA denial, expiry, outage/retry, response loss และ real-DB concurrency/cleanup races
- [x] รัน relevant auth/user-create/asset-status regressions โดยรักษา ADMIN operational restrictions, BetterAuth compensation และ metadata-only edit semantics; แยกผล deterministic HTTP suite กับ real-Cloudinary suite ชัดเจน
- [x] สรุป actual Cloudinary account capability, source enforcement/pixel/format/static-image limits, transforms/metadata/color/orientation, restricted expiry, observed cache headers, replay reconciliation และ request/bandwidth trade-offs จากหลักฐานที่รันจริง; ไม่อ้าง account-specific billing/credit charge ที่ไม่ได้วัด
- [x] หากยังไม่มี credential/account capability, source proof หรือ cache decision ที่จำเป็น ให้บันทึก external gate และ work remaining ห้าม mark BE handoff complete หรือเปิด FE เริ่มเพราะ fake tests ผ่าน
- [x] API reference/handoff มี request/response/error examples, upload versus attachment distinction, one-hour deadlines, outcome recovery, pending preview scope, employee read scope, no-photo/revision/expiry semantics และ no-store contract โดยไม่มี secret หรือใช้งาน signed grant จริงเผยแพร่
- [x] Configuration checklist ครอบคลุม provider environment/BE-only secrets, signed purpose policies, source/output limits, lifetimes, cleanup budgets/intervals, feature activation, missing-config behavior และ test environment/manifest cleanup
- [x] Inventory callers ของ shared asset/user writes และ image response/session consumers รวม deferred wait-disposal Base64 caller; ระบุผลกระทบต่อ managed URL/locator consistency ไม่กล่าวว่าทุก Base64 caller migrated แล้ว
- [x] บันทึกมติแยก FE development/acceptance ในระบบทดสอบจาก production cutover วันที่ 2026-10-04: G4 ยังไม่ผ่านสำหรับ release, production managed activation คงปิด, ระบบทดสอบใช้ข้อมูลทิ้งได้และ provider cloud แยก; ไม่เลือก Base64 exception, silent field ignore หรือแก้รอจำหน่าย
- [x] มี deployment/activation sequencing ที่ทำ BE เสร็จก่อน FE ได้ โดยตรวจ BE contract ด้วย API/test clients และไม่เปิด unsafe shared writes ระหว่าง transition; ถ้าจำเป็นต้องมีมติทีมให้แสดงเป็น external gate ไม่ทำ FE ก่อนเป็นทางลัด
- [x] มี seed policy แยก unmanaged fixture URLs จาก managed provider objects; employee seed ไม่เป็น production public-photo bypass และไม่มีการ sign/fetch/delete unknown fixture URLs
- [x] มี targeted Base64 test-residue cleanup procedure ตรวจ exact rows/image fields ก่อน clear เฉพาะข้อมูลทดลองที่อนุญาต ไม่ reset DB/ลบ business records/seed URLs ทั้งชุด และรายงานแยกว่าขั้นตอนใดแค่เตรียมไว้หรือได้ทำจริงใน authorized environment
- [x] บันทึก G1–G3 ผ่านและ scoped transition ที่ผู้ใช้อนุมัติ พร้อม contract baseline 2026-10-04; G5/05 complete สำหรับ isolated FE และปลด blocker ของ 06 โดยไม่อ้าง G4 production cutover ผ่านแล้ว

## Completion boundary

05 เป็น **BE handoff barrier สำหรับ isolated FE** ตามมติผู้ใช้ 2026-10-04 และ spec ที่ปรับแล้ว ปิดได้ด้วย G1–G3 ที่ตรวจแล้วและ scoped transition เพื่อเริ่ม 06/07 ในระบบทดสอบเท่านั้น G4 แยกเป็น **production release barrier**; การปิด 05 ไม่อนุญาต deploy/เปิด managed writes ใน production หรือทดลองกับลูกค้าจริงก่อนผ่าน G4 และ release acceptance

Contract baseline: [Image Upload API](../../../docs/image-uploads-api.md), [handoff/gates](../../../docs/image-backend-handoff.md), [G2](../../../docs/image-read-g2-verification.md), [G3](../../../docs/image-cleanup-g3-verification.md), และ [ADR 0005](../../../docs/adr/0005-employee-photo-cache-and-isolated-fe-handoff.md). เปิด managed attachment ได้เฉพาะ Backend process ของระบบทดสอบที่ใช้ฐานข้อมูลและ Cloudinary cloud แยก; production setting ไม่ได้ถูกตรวจหรือเปลี่ยนในงานนี้

ไม่เปลี่ยน wait-disposal image field, “ยืนยันรับเครื่องคืน”, repair outcome/custody logic หรือ disposal evidence การยืนยัน breakdown ของ tickets ไม่ใช่มติใหม่สำหรับ flow ที่ผู้ใช้เว้นไว้
