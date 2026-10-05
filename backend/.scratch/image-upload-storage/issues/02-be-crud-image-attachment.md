# 02 — BE: เพิ่มและเปลี่ยนรูปผ่าน Asset/User CRUD อย่างปลอดภัย

**What to build:** เพิ่มหรือเปลี่ยนรูปหลักหนึ่งรูปผ่านการบันทึก Asset/User CRUD เดิมได้ รวมการสร้างบัญชีพร้อมรูปก่อนมี target ID การสร้างโดยไม่มีรูป และการเพิ่มรูปทีหลัง โดย failed save ไม่ทำรูปเดิมหายและ retry ไม่ย้อนรูปใหม่ของผู้อื่น

**Blocked by:** [01 — BE: อัปโหลดและแปลงรูปผ่าน Storage Abstraction](01-be-direct-upload-and-normalization.md).

**Owner / change boundary:** Backend asset/user CRUD และ transactional image attachment; รวม HTTP/real-DB tests ไม่แก้ FE หรือ flow รอจำหน่าย

**Status:** complete on 2026-10-03 (HTTP/PostgreSQL, unit, and asset-status regression suites pass).

**Source spec:** [Image upload storage specification](../spec.md) — Implementation Decisions 1, 4–6, 9; Testing Decisions.

## Acceptance criteria

- [x] Asset/User create/edit รับ optional nonempty `imageUploadId` ตาม purpose; server rechecks current permission, owner, target/creation context, verified identity/state และ deadline ก่อน claim ไม่ถือว่า upload authorization เดิมเพียงพอ
- [x] รองรับหนึ่งรูปต่อ record โดย account/asset ไม่มีรูปเริ่มต้นได้; omission บน edit รักษารูปที่ committed ปัจจุบัน และ null/empty/malformed reference ไม่ลบ attachment
- [x] รูปจาก new cloud-backed flow เก็บ URL + minimal provider-file metadata บน record ไม่บังคับ central image-ID FK; Asset URL เป็น BE-derived HTTPS versioned public URL ส่วน managed Employee Photo เก็บ locator/version และ durable `imageUrl` เป็น null
- [x] Locator fields มี complete/absent invariant และระบุ object/version/resource/delivery/environment ที่จำเป็น; arbitrary writable `imageUrl`, provider name/key หรือการ parse URL ของ FE ไม่ใช่หลักฐาน valid attachment
- [x] Commit business fields, image metadata, single upload claim/outcome และ cleanup eligibility ของ attachment ที่ถูกแทนจริงใน DB transaction เดียว; transaction ล้มเหลวไม่เหลือ false claim, cleanup work หรือครึ่งหนึ่งของ locator state
- [x] ไม่มี provider upload/verification/delete network call ใน DB transaction; verify ก่อน transaction แล้ว recheck authoritative state/identity/expiry/current authorization ตอน commit
- [x] Create ที่มี pending image ก่อนมี target ID claim creation context ได้ครั้งเดียวและผูกกับ target ใหม่; upload เดียวใช้ข้าม record/owner/purpose ไม่ได้
- [x] Preserve user prevalidation/BetterAuth compensating rollback: failure ของ final profile/photo transaction ไม่เหลือ photo claim อ้างบัญชีที่ rollback; failure ในการตอบ photo/grant หลัง commit สำเร็จไม่ trigger account compensation
- [x] Failed upload/verification/CRUD save ไม่เปลี่ยน attachment เดิม และ request ที่ตั้งใจเปลี่ยนรูปแต่ทำไม่ได้ส่ง error ชัดเจน ไม่รายงานสำเร็จพร้อมละทิ้งรูปที่ร้องขอ
- [x] Last successful serialized DB save wins สำหรับ image replacement โดยไม่มี stale-photo conflict dialog/edit lock; A→B→C จบที่ C และ eligibility ระบุ A/B จาก actual committed transitions ไม่ใช้ stale form reference
- [x] Stale metadata-only edit ที่ omit image field รักษา current committed photo; existing conflicts/invariants ของ operational status/availability คงเดิม ไม่เพิ่ม restriction ให้ image-only edit ขณะ borrowed/repair
- [x] Completion/attachment/outcome retries มี semantics ชัดเจน: response lost หลัง commit กู้ original claim/target ได้ ไม่สร้าง duplicate photo-linked account/asset; superseded upload ไม่ถูก reattach และไม่ replay stale business edits ทับ save ใหม่
- [x] เก็บ cleanup work ของ superseded managed object หลัง commit โดยไม่ลบ provider ทันทีหรือ retain history; ไม่มี trusted locator ของ seed fixture จึงไม่ enqueue การลบจาก arbitrary URL
- [x] มี HTTP tests และ dedicated PostgreSQL transaction/concurrency tests สำหรับ create/add/replace/omit/null/expired/wrong claim, compensation/rollback, response-loss recovery และ A→B→C; permission tests ใช้ guards จริงและไม่อ้าง mocked transaction ว่าพิสูจน์ atomicity แล้ว
- [x] New contract อยู่ภายใต้ activation/release boundary ที่ชัดเจนจนกว่าจะผ่าน 05: ไม่เลือก temporary Base64 exception, global shared rejection หรือ silent image-field ignore แทนมติทีม และไม่เปิดทาง legacy caller ทำ managed URL/locator ไม่สอดคล้องกัน

## Handoff and boundaries

03 ใช้ durable current-photo locator/revision เพื่อเปิดดู; 04 ใช้ committed superseded cleanup eligibility เพื่อกวาดล้าง รูปพนักงานยัง ADMIN-managed ไม่มี standalone removal และไม่มีการ redesign user retention/auth หรือ asset-status concurrency ทั้งระบบ

งานที่ตรวจได้ในใบนี้เป็น additive API/DB attachment behavior บน isolated test/feature environment การส่ง shared write contract ให้ใช้งานจริงยังต้องผ่าน G4/05 ไม่แก้ wait-disposal form, checkbox หรือ repair/custody logic ในใบนี้
