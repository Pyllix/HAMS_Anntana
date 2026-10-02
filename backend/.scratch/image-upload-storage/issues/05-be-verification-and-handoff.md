# 05 — BE: ตรวจครบและส่งมอบ Backend Contract ให้ FE

**What to build:** BE ของ feature รูป asset/user พร้อมใช้งานตาม contract ที่ตรวจสอบได้ มี API/error/configuration/test evidence ครบ และมี shared-contract cutover ที่ปลอดภัย เพื่อให้ FE เริ่มได้โดยไม่เหลืองาน backend ไปซ่อนใน tickets หน้าจอ

**Blocked by:** [03 — BE: เปิดดูรูปและกำหนด Read/Cache Contract](03-be-image-read-and-cache-contract.md); [04 — BE: ล้างรูปค้างและรูปเก่า พร้อมกู้หลัง Restart](04-be-image-cleanup-and-recovery.md). งาน 01–02 ต้อง complete ผ่าน dependencies ก่อนหน้าแล้วด้วย

**Owner / change boundary:** Backend integration/regression, compatibility review, configuration และ FE handoff; ยังไม่แก้ FE ไม่ตัดสินรอจำหน่ายแทนทีม และไม่ถือการเขียน ticket เป็น authorization ให้ mutate production

**Status:** ready-for-agent

**Source spec:** [Image upload storage specification](../spec.md) — Implementation Decisions 9; Testing Decisions/G1–G5; Out of Scope.

## Acceptance criteria

- [ ] ตรวจ 01–04 complete จริงทั้งพฤติกรรมและ evidence ของ G1–G3 ไม่มี required BE behavior ที่จะไปทำใน 06/07 และไม่ถือ skipped dedicated-DB/live-provider suites ว่า pass
- [ ] ทดสอบ API flow รวม upload→verify→create/claim→read→replace→cleanup พร้อม auth/CSRF/session/2FA denial, expiry, outage/retry, response loss และ real-DB concurrency/cleanup races
- [ ] รัน relevant auth/user-create/asset-status regressions โดยรักษา ADMIN operational restrictions, BetterAuth compensation และ metadata-only edit semantics; แยกผล deterministic HTTP suite กับ real-Cloudinary suite ชัดเจน
- [ ] สรุป actual Cloudinary account capability, source enforcement/pixel/format/static-image limits, transforms/metadata/color/orientation, restricted expiry, observed cache headers, replay reconciliation และ request/bandwidth trade-offs จากหลักฐานที่รันจริง
- [ ] หากยังไม่มี credential/account capability, source proof หรือ cache decision ที่จำเป็น ให้บันทึก external gate และ work remaining ห้าม mark BE handoff complete หรือเปิด FE เริ่มเพราะ fake tests ผ่าน
- [ ] API reference/handoff มี request/response/error examples, upload versus attachment distinction, one-hour deadlines, outcome recovery, pending preview scope, employee read scope, no-photo/revision/expiry semantics และ no-store contract โดยไม่มี secret หรือใช้งาน signed grant จริงเผยแพร่
- [ ] Configuration checklist ครอบคลุม provider environment/BE-only secrets, signed purpose policies, source/output limits, lifetimes, cleanup budgets/intervals, feature activation, missing-config behavior และ test environment/manifest cleanup
- [ ] Inventory callers ของ shared asset/user writes และ image response/session consumers รวม deferred wait-disposal Base64 caller; ระบุผลกระทบต่อ managed URL/locator consistency ไม่กล่าวว่าทุก Base64 caller migrated แล้ว
- [ ] G4 ผ่านด้วย proven safe isolation หรือ separately approved integration/cutover decision ที่มีหลักฐาน; ไม่เลือก temporary Base64 exception, global rejection, silent field ignore หรือแก้รอจำหน่ายเองเพื่อให้ปิดงานได้
- [ ] มี deployment/activation sequencing ที่ทำ BE เสร็จก่อน FE ได้ โดยตรวจ BE contract ด้วย API/test clients และไม่เปิด unsafe shared writes ระหว่าง transition; ถ้าจำเป็นต้องมีมติทีมให้แสดงเป็น external gate ไม่ทำ FE ก่อนเป็นทางลัด
- [ ] มี seed policy แยก unmanaged fixture URLs จาก managed provider objects; employee seed ไม่เป็น production public-photo bypass และไม่มีการ sign/fetch/delete unknown fixture URLs
- [ ] มี targeted Base64 test-residue cleanup procedure ตรวจ exact rows/image fields ก่อน clear เฉพาะข้อมูลทดลองที่อนุญาต ไม่ reset DB/ลบ business records/seed URLs ทั้งชุด และรายงานแยกว่าขั้นตอนใดแค่เตรียมไว้หรือได้ทำจริงใน authorized environment
- [ ] บันทึก BE acceptance/handoff ว่า G1–G4 ผ่านหรือมี scoped decision ที่อนุมัติจริงตาม spec และกำหนด contract baseline ให้ FE ใช้; 05 จึง complete ได้และปลด blocker ของ 06

## Completion boundary

05 เป็น **BE phase barrier** ไม่ใช่ ticket ที่รวม FE ไว้ ถ้ามี gate ที่ยังไม่แก้ให้ทำ BE งานที่ไม่ถูก gate ต่อได้ แต่ไม่ปิด 05 หรือเริ่ม 06/07 จนเกณฑ์ handoff ครบ

ไม่เปลี่ยน wait-disposal image field, “ยืนยันรับเครื่องคืน”, repair outcome/custody logic หรือ disposal evidence การยืนยัน breakdown ของ tickets ไม่ใช่มติใหม่สำหรับ flow ที่ผู้ใช้เว้นไว้
