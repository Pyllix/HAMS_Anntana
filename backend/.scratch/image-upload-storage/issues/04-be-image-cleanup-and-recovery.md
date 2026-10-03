# 04 — BE: ล้างรูปค้างและรูปเก่า พร้อมกู้หลัง Restart

**What to build:** รูป pending ที่หมด attachment window 1 ชั่วโมง รูป invalid/abandoned และรูปเก่าหลังเปลี่ยนสำเร็จถูกล้างอย่างปลอดภัย งานค้างกลับมาทำต่อหลัง Render หลับ/restart หรือ provider ล่มได้ โดยไม่ลบรูปที่ยังใช้งาน

**Blocked by:** [02 — BE: เพิ่มและเปลี่ยนรูปผ่าน Asset/User CRUD อย่างปลอดภัย](02-be-crud-image-attachment.md).

**Owner / change boundary:** Backend durable cleanup/reconciliation และ transaction/claim coordination; รวม HTTP, dedicated DB และ real-provider recovery tests ไม่ทำ UI หรือเพิ่ม infrastructure ที่มีค่าใช้จ่าย

**Status:** implemented; dedicated-DB and real-provider acceptance verification pending

**Verification:** Prisma schemas, backend build, Ticket 04 ESLint, focused image unit tests, and the full unit suite passed (450/450 on the final run). The dedicated PostgreSQL HTTP acceptance suite was not run because no isolated `TEST_DATABASE_URL` or local Docker database is available. G3 remains pending until the opt-in Cloudinary contract is run with its separate test account; see [image cleanup verification](../../../docs/image-cleanup-g3-verification.md).

**Source spec:** [Image upload storage specification](../spec.md) — Implementation Decisions 4, 6–7, 9; Testing Decisions/G3.

## Acceptance criteria

- [x] ใช้ configurable pending attachment window 1 ชั่วโมงจาก trusted provider creation time ของ normalized object ตาม spec ไม่ใช้ FE time/completion retry เป็นการ renew; เก็บ initial intent deadline และ provider authorization deadline แยกจาก attachment expiry
- [x] At/after expiry ไม่รับ new claim แม้ยังไม่ได้ลบ provider object; attached image ไม่หมดอายุตาม pending TTL และ retry เพื่ออ่าน committed outcome ไม่ถูกสับสนกับ new claim
- [x] Cleanup work อยู่ DB และ resume หลัง restart ได้ รวม invalid/expired/unattached uploads และ superseded object ที่ eligible หลัง replacement commit; failed delete ไม่ undo successful CRUD save
- [x] มี startup และ configurable interval sweeps ขณะ BE awake จำกัด batch/request timeouts/budget ใช้ safe leases/backoff/retry ไม่ block normal CRUD และไม่ทำ keep-alive เพื่อหลบ Render sleep
- [x] ตรวจ reference และประสาน claim state ก่อนลบ; cleanup ที่ claim expired/superseded object แล้วไม่ให้ concurrent save attach กลับ และ cleanup/claim race ไม่ลบ active retained attachment
- [x] Reference checks รวมรูปบน soft-deleted users ที่ยัง restore ได้; ไม่เพิ่ม account deletion retention policy หรือถือ soft-delete เป็น abandoned photo
- [x] Provider deletion ใช้ exact trusted immutable object/environment identity ผ่าน Storage port ไม่ parse/fetch/delete arbitrary URLs; provider not-found สำเร็จแบบ idempotent และไม่ retry ไปตลอด
- [x] Closing form หลังอัปโหลดแต่ก่อน complete ยัง reconcile known allocated key ได้; intent ที่ไม่มี completion ไม่ทิ้ง uploaded orphan ไว้ถาวร และ pending selection ใหม่ไม่ลบ committed photo
- [x] แยก HAMS intent/attachment deadline จาก provider signature validity; คง tombstones/reconciliation ผ่าน signature validity และ tested in-flight settlement horizon ไม่ reopen expired claims
- [x] Late uploads, replay และ alternate-resource variants ใต้ allocated HAMS identity ไม่หลุด tracking; probes ถูกจำกัดและ rate-limit/outage ยังเหลืองาน durable ให้ทำต่อ ไม่ scan/delete Cloudinary account ทั้งหมด
- [x] ไม่ retain source/history/extra derivatives โดย policy ใหม่ และไม่ลบ seed fixture URLs/unrelated provider objects ที่ไม่มี trusted managed locator
- [x] มี sanitized operation/state/retry logs และผลตรวจ backlog ที่ช่วย debug ได้ โดยไม่ log secret, signed URL เต็ม หรือ embedded employee capture metadata
- [ ] HTTP/real-DB tests พิสูจน์ expired rejection, last-save cleanup candidates, rollback/commit boundary, lease/retry/idempotent not-found, retained reference, concurrent claim/delete และ restart recovery; clock tests ไม่ต้องรอจริงหนึ่งชั่วโมง
- [ ] Opt-in real-provider tests/manifest-scoped teardown พิสูจน์ unreported/late/replayed upload reconciliation และ delete/not-found behavior; บันทึก G3 รวม actual request budget และข้อจำกัด ไม่อ้าง exact physical deletion SLA

## Handoff and boundaries

03 และ 04 เริ่มแยกกันได้หลัง 02; ใบนี้ไม่ขึ้นกับ display/read grant API เมื่อ 04 เสร็จให้ 05 มีหลักฐานว่า TTL ควบคุม attachment และ physical deletion อาจล่าช้าตอน BE หลับ/deploy/provider ล่มตามที่ยอมรับแล้ว

ไม่เพิ่ม paid Render worker/cron, Redis, persistent image disk, standalone remove endpoint หรือ cloud-wide deletion workflow
