# แนวทางย้ายทะเบียน Asset ตั้งต้นเข้า HAMS

ตรวจสอบ: 6 ตุลาคม 2026 — ขอบเขตคือ dev นำเข้าทะเบียนครั้งแรก ไม่ใช่ฟีเจอร์อัปโหลดสำหรับผู้ใช้ และยังไม่มีตัวอย่าง export จริง

## ข้อเสนอสำหรับโปรเจกต์นี้

ใช้ pipeline แบบ ETL ที่รันด้วยคำสั่งแยก: **Raw → Normalize/Canonical → Validate/Map → Review/Staging → Load → Reconcile** เริ่มจากไฟล์เป็น staging ก็เพียงพอ แล้วเพิ่มตาราง staging เมื่อปริมาณหรือความซับซ้อนพิสูจน์ว่าจำเป็น ข้อนี้เป็นข้อเสนอเชิงสถาปัตยกรรมสำหรับ HAMS ไม่ใช่การอ้างสถิติความนิยมของเครื่องมือ

แนะนำแกนหลักเป็น TypeScript CLI + Prisma เพราะ repo ใช้ NestJS, TypeScript, Prisma 7.9.1, PostgreSQL และมีรูปแบบ script แยกใน `prisma/seed-reference.ts` อยู่แล้ว ([package.json](../../package.json), [seed-reference.ts](../../prisma/seed-reference.ts)). ใช้ ExcelJS เป็นตัวอ่าน `.xlsx` ได้ตาม README ทางการ; หากข้อมูลยุ่งมากหรือผู้เตรียมข้อมูลถนัด Python อาจใช้ pandas เป็นขั้นเตรียม แล้วส่งออก canonical JSON/CSV เข้า loader เดิม ([ExcelJS: Reading XLSX](https://github.com/exceljs/exceljs#reading-xlsx), [pandas: read_excel](https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html)).

ยังเลือก engine และเขียนตัวอ่านต้นทางให้เสร็จไม่ได้จนกว่าจะรู้ชนิดไฟล์ ชื่อ sheet แถวหัวตาราง หนึ่งแถวแทนอะไร และมี key ระบุเครื่องหรือไม่ แต่กำหนด canonical contract, validation rules และรายงานผลล่วงหน้าได้

## แต่ละขั้นทำอะไร

| ขั้น | การทำงานและผลลัพธ์ที่แนะนำ |
|---|---|
| Raw | เก็บต้นฉบับไม่แก้ไข พร้อม file hash, วันที่ข้อมูล, source system, ชื่อ sheet, เลขแถวจริง และ run ID; raw ไม่ควรอยู่ใน Git |
| Normalize/Canonical | แปลงชื่อช่อง ตัดช่องว่างตามกติกา รักษารหัสเป็นข้อความ แปลงเงินเป็น decimal string วันที่เป็นรูปแบบชัดเจน และรักษาค่า raw เพื่อย้อนเทียบ |
| Validate/Map | ตรวจ required fields, ความยาว, รูปแบบ, วันที่ พ.ศ./ค.ศ. ตามข้อกำหนดต้นทาง, key ซ้ำ และจับคู่หน่วยงาน/ประเภท/บริษัท/ผู้รับผิดชอบกับ ID ใน HAMS |
| Review/Staging | แยก ready, rejected, ต้องให้ลูกค้าตัดสินใจ และรายการที่เคยนำเข้าแล้ว; ให้เหตุผลรายแถว และบันทึก mapping/กติกาที่ลูกค้ายืนยัน |
| Load | อ่านเฉพาะชุดที่ตรวจแล้วและล็อกเวอร์ชันไฟล์/กติกา; ตรวจข้อกำหนดซ้ำกับฐานปลายทาง และนำเข้าเป็น batch พร้อม checkpoint |
| Reconcile | ตรวจทุกแถวถูกจัดหมวดครบ จำนวนพร้อมนำเข้าเท่ากับที่เพิ่มหรือข้ามตาม mapping และสุ่มตรวจค่ากับต้นฉบับ; เทียบยอดเงินเฉพาะเมื่อทราบหน่วยและความหมายราคา |

รูปแบบ canonical อาจมี `sourceSystem`, `sourceAssetKey`, `sourceFileHash`, `sourceSheet`, `sourceRow`, `name`, `model`, `price`, `receivedDate`, รหัสอ้างอิง และสถานะต้นทาง การจัดเก็บ JSON Lines ช่วยแยกข้อมูลรายแถวได้ ส่วน CSV เหมาะกับรายงานตรวจสอบ โดยต้องกำหนด quoting, encoding และความหมายช่องว่างให้ชัดเจน ทั้งสองรูปแบบเป็นทางเลือก ไม่จำเป็นต้องใช้พร้อมกัน

เก็บ mapping เช่น “แผนก A → section ID ที่ลูกค้ายืนยัน” แยกจากตัวอ่านไฟล์ การแก้ไขควรลงในกติกาหรือไฟล์ override แล้วรันใหม่ เพื่อให้ทำซ้ำและอธิบายการเปลี่ยนค่าได้ ไม่แก้ต้นฉบับเป็นหลักฐานเพียงชุดเดียว

## ข้อกำหนดที่พบจาก HAMS

- `Asset` บังคับ `name`, `model`, `price`, `receivedDate`, `type_id`, `section_id`, `company_id`, `asset_status_id`, `owner_id`, `createdBy`, `updatedBy`; `noid` และ `serialNo` เป็น nullable โดย `noid` มีเพียง index ไม่ใช่ unique constraint ([Asset schema](../../prisma/schema/asset.prisma)).
- ห้ามสมมติ `model`, ราคา, วันที่รับ, บริษัท หรือผู้รับผิดชอบเพื่อให้ผ่าน schema หากไม่มีข้อมูลให้แยกไว้รอลูกค้ายืนยัน หรือพิจารณาปรับแบบจำลองข้อมูลโดยมีข้อตกลงก่อน ค่าเริ่มต้นเชิงนโยบายทำได้เมื่อได้รับความเห็นชอบและบันทึกเหตุผล เช่นบัญชีผู้ดำเนินการนำเข้าเป็น `createdBy`; ต้องไม่ใช้บัญชีนั้นเป็นเจ้าของครุภัณฑ์โดยอัตโนมัติ
- ไม่ควรตั้งเครื่องทั้งหมดเป็นพร้อมยืม เพราะการมีทะเบียนไม่ยืนยันว่าเครื่องว่าง ต้องกำหนด baseline สถานะและ availability จากหลักฐานหรือข้อตกลง โดยเฉพาะจำหน่าย ซ่อม และการยืมที่ยังค้าง
- ขั้นตอนจำหน่ายปัจจุบันห้ามเครื่องที่ยืมหรือจอง มีการตรวจ status transition และบันทึกสถานะ `DISPOSAL` + `UNAVAILABLE` กับ Disposal ใน transaction เดียวกัน; Disposal ต้องมีเลขเอกสารและวันที่อนุมัติ ([asset.service.ts](../../src/asset/asset.service.ts), [Disposal schema](../../prisma/schema/disposal.prisma)).
- ถ้าทะเบียนต้นทางมีเครื่องจำหน่ายแต่ไม่มีเอกสาร ต้องออกแบบกรณี “สถานะตั้งต้นจากระบบเดิม” ให้ชัดก่อนนำเข้า ห้ามสร้างประวัติจำหน่ายเทียม แม้ไม่ย้ายประวัติทั้งหมดก็ต้องรักษาความหมายของสถานะเพื่อไม่เปิดเครื่องจำหน่ายให้ยืม
- เขียนผ่าน Prisma ไม่ได้เรียก NestJS service validation อัตโนมัติ จึงต้องให้ loader ตรวจ business rules ที่เกี่ยวข้องด้วย ไม่ใช่อาศัย foreign keys อย่างเดียว

## รันซ้ำโดยไม่เพิ่มเครื่องซ้ำ

เริ่มแบบ **insert-only baseline**: เพิ่มเครื่องใหม่ ข้ามเครื่องที่พิสูจน์ว่ารอบเดิมเพิ่มแล้ว และรายงานความขัดแย้ง ไม่ใช้ blind upsert เพื่อเขียนทับทะเบียนที่เจ้าหน้าที่เริ่มแก้แล้ว

ต้องเก็บความเชื่อมโยงถาวร `sourceSystem + sourceAssetKey → asset.id` พร้อม row hash และรุ่นกติกา หากจะใช้ตาราง mapping ให้บังคับ unique ที่คู่ source identity จริง และบันทึก mapping กับ Asset ใน transaction เดียวกัน จะเพิ่มตารางนี้ภายหลังต้องทำ schema migration แยกต่างหาก

หากใช้ mapping manifest เป็นไฟล์ในรุ่นแรก ให้จัด Asset UUID ใน manifest ที่ล็อกไว้ **ก่อน** เขียนฐานข้อมูล แล้วรันซ้ำด้วย UUID เดิม โดยมีหนึ่ง loader ทำงานและตรวจ payload conflict; อย่าพึ่งบันทึกไฟล์ mapping หลัง commit เพียงอย่างเดียว เพราะไฟล์อาจเขียนล้มเหลวหลังฐานข้อมูลสำเร็จ เลขแถว/file hash ใช้ตรวจต้นทางและ retry ไฟล์เดิมได้ แต่ไม่ใช่ identity ถาวรข้าม export ที่สลับแถว; ถ้าไม่มี key ให้ลูกค้ายืนยันการจับคู่และเก็บทะเบียน mapping ก่อนรับไฟล์ใหม่

Prisma ระบุว่า idempotency ต้องออกแบบให้มี unique constraint จริง และ `createMany({ skipDuplicates: true })` ข้ามได้เฉพาะค่า unique ที่ซ้ำ ดังนั้นใช้ `noid` ป้องกันซ้ำไม่ได้ใน schema ปัจจุบัน ([Prisma: idempotent APIs](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions#idempotent-apis), [Prisma: create multiple records](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/crud#create-multiple-records)).

## ประสิทธิภาพและการกู้คืน

Prisma มี bulk operations และ transaction API; แนะนำอ่าน/clean/validate นอก transaction แล้วใช้ `createMany` สำหรับข้อมูลที่ resolve foreign keys เรียบร้อย หรือ transaction ของ writes ที่ต้องสำเร็จร่วมกัน Prisma แนะนำให้ transaction สั้นเพราะ transaction ยาวกระทบ performance และเกิด deadlock ได้ ([Prisma 7: transactions and batch queries](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions)).

เลือกขนาด batch จากเวลาทดลองกับข้อมูลจริง ไม่ล็อกตามจำนวนแถวล่วงหน้า; เก็บสถานะแต่ละ batch และรายการ IDs ที่ commit แล้ว ความเป็น atomic ครอบคลุมแต่ละ transaction เท่านั้น: batch หลังล้มเหลวไม่ได้ undo batch ก่อนที่ commit ไปแล้ว ต้อง resume จาก mapping/checkpoint หรือใช้แผนย้อนข้อมูลที่กำหนดไว้

ถ้าทดลองแล้วการโหลดเป็นคอขวดและข้อมูลมาก อาจใช้ PostgreSQL `COPY` เข้า **staging table** แล้วตรวจ/ย้ายเข้าตารางจริง โดย loader ยังต้องรักษา mapping และ application rules เอกสาร PostgreSQL ระบุว่า COPY มี overhead ต่ำสำหรับข้อมูลจำนวนมาก แต่ยืดหยุ่นน้อยกว่า INSERT; ไม่มีเหตุผลต้องเพิ่มความซับซ้อนนี้ก่อนเห็นปริมาณจริง ([PostgreSQL: populating a database](https://www.postgresql.org/docs/current/populate.html)).

ก่อนเปิดใช้งานจริงให้ทดลองบนฐานทดสอบและมี backup/แผน restore ช่วง cutover; หลังผู้ใช้สร้างรายการยืม ซ่อม หรือแก้ทะเบียนแล้ว การลบตาม run ID หรือ restore backup อาจลบงานใหม่หรือชน foreign keys จึงต้องประเมินความสัมพันธ์และใช้การแก้ไขเฉพาะรายการ ไม่ถือว่า rollback ได้ทุกเมื่อ

## ข้อควรระวังตอนอ่าน Excel

pandas รองรับ `dtype` และ `converters` โดย converters มีผลแทน dtype; `dtype=object` รักษาค่าตามที่เก็บในไฟล์ ไม่ได้สร้างเลขศูนย์หรือเลขหลักที่ต้นทางเสียไปแล้ว ให้กำหนดคอลัมน์รหัสและนโยบาย missing values อย่างชัดเจน เพราะค่าเริ่มต้นตีความข้อความเช่น `NA`/`NULL` เป็นค่าว่างได้ คอลัมน์วันที่ที่ซับซ้อนควรอ่านแล้วแปลงตามกติกาต้นทาง และหลีกเลี่ยง forward fill โดยไม่ทราบว่าข้อมูลที่ merge หมายถึงอะไร ([pandas: read_excel](https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html)).

สิ่งที่ต้องขอก่อนเริ่ม implement: ตัวอย่าง export, key ถาวรของเครื่อง, ความหมาย/หน่วยของช่อง, จำนวนแถวคร่าว ๆ, สถานะ ณ วันที่ข้อมูล และผู้ยืนยัน mapping/ข้อมูลขาด บันทึกนี้เป็นแนวทางเท่านั้น ยังไม่ได้ติดตั้งเครื่องมือ เปลี่ยน schema หรือสร้าง pipeline
