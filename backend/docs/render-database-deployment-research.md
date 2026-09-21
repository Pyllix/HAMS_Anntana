# แนวทาง Deploy Backend และ Database บน Render แบบอัตโนมัติ

> ขอบเขต: HAMS backend (`NestJS` + `Prisma 7.9.1` + `PostgreSQL` + `pnpm`)  
> วันที่ตรวจสอบเอกสาร: 2026-09-21  
> แหล่งข้อมูล: เอกสารทางการของ Render และ Prisma เท่านั้น

## สรุปสั้นที่สุด

แนวทางที่เหมาะกับโปรเจกต์นี้คือ:

1. นักพัฒนาสร้าง migration ในเครื่องด้วย `prisma migrate dev` แล้ว commit ทั้ง Prisma schema และโฟลเดอร์ `prisma/migrations` ไปพร้อมโค้ด
2. Render รัน `prisma migrate deploy` อัตโนมัติใน **Pre-Deploy Command** ก่อนนำ backend รุ่นใหม่ขึ้นใช้งาน
3. Production ห้ามใช้ `prisma migrate reset`, `prisma migrate dev` หรือ `prisma db push` เป็นขั้นตอน deploy ปกติ
4. การแก้ schema ที่ลบ/เปลี่ยนชื่อคอลัมน์ต้องแบ่งเป็นหลาย release แบบ expand-and-contract เพื่อให้ backend รุ่นเก่าและใหม่ใช้ฐานข้อมูลร่วมกันได้ระหว่าง zero-downtime deploy
5. ต้องตรวจ migration history และทำ backup ก่อนเปิด automation ครั้งแรก เพราะ repo นี้มี migration เก่าที่เป็น destructive migration

เมื่อจัด workflow นี้แล้ว การแก้เฉพาะโค้ดสามารถ push ได้ตามปกติ ส่วนการแก้ schema เพียงสร้างและ commit migration เพิ่ม จากนั้น Render จะ apply เฉพาะ migration ที่ยังค้างให้อัตโนมัติ; `migrate deploy` ไม่ reset ฐานข้อมูลและไม่ replay migration ที่บันทึกว่า apply แล้ว ([Prisma: `migrate deploy`](https://www.prisma.io/docs/cli/v7/migrate/deploy), [Prisma: deploy database changes](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)).

## สิ่งที่พบใน repo ปัจจุบัน

- Framework: NestJS 11 / TypeScript
- ORM: Prisma 7.9.1
- Database: PostgreSQL ผ่าน `@prisma/adapter-pg`
- Package manager: pnpm
- Prisma schema แบ่งเป็นหลายไฟล์ใต้ `prisma/schema`; migration อยู่ใน `prisma/migrations`
- มีคำสั่ง development แล้ว:
  - `prisma:migrate`: `prisma migrate dev`
  - `prisma:reset`: generate + migrate dev + seed
- ยังไม่มีคำสั่ง production เช่น `prisma migrate deploy`
- ไม่พบ `render.yaml` ใน root จึงน่าจะตั้งค่า deploy ผ่าน Render Dashboard อยู่ในปัจจุบัน

ข้อควรระวังสำคัญก่อนเปิด auto-migration:

- `prisma/migrations/20260831155210_reset_database/migration.sql` มีการ drop ตารางและหลายคอลัมน์
- `prisma/migrations/20260912172600_refactor_transfer_to_direct_transfer/migration.sql` มีการ drop คอลัมน์ของ transfer
- การมีไฟล์เหล่านี้ไม่ใช่ปัญหาหาก production apply แล้วและ `_prisma_migrations` ตรงกับ repo แต่เป็นความเสี่ยงหาก production เคยสร้างด้วย `db push` หรือแก้ schema ด้วยมือจนไม่มี migration history ที่ตรงกัน

ดังนั้น **อย่าเพิ่งนำ `migrate deploy` ไปชี้ production โดยไม่รัน `prisma migrate status` และตรวจ backup ก่อน**

## Workflow ที่แนะนำ

### 1. Development: สร้าง migration ในเครื่อง

เมื่อแก้ Prisma schema:

```bash
pnpm exec prisma migrate dev --name describe_the_change
pnpm exec prisma generate
pnpm run test
```

จากนั้น review SQL ที่ Prisma สร้าง และ commit อย่างน้อย:

```text
prisma/schema/**
prisma/migrations/**
```

`migrate dev` มีหน้าที่สร้างและ apply migration ใน development ส่วน `migrate reset` จะล้างข้อมูลและสร้างฐานใหม่ จึงเป็นคำสั่งสำหรับ development เท่านั้น ([Prisma CLI v7: migrate commands](https://www.prisma.io/docs/cli/v7/migrate)).

### 2. Production: apply เฉพาะ migration ที่ค้าง

แนะนำเพิ่ม script ใน `package.json` ในงาน implementation ถัดไป:

```json
{
  "scripts": {
    "prisma:deploy": "prisma migrate deploy",
    "prisma:status": "prisma migrate status"
  }
}
```

ค่าที่แนะนำบน Render สำหรับ native Node runtime:

```text
Build Command:
pnpm install --frozen-lockfile && pnpm run prisma:generate && pnpm run build

Pre-Deploy Command:
pnpm run prisma:deploy

Start Command:
pnpm run start:prod
```

Render ระบุว่า Pre-Deploy Command รันหลัง build แต่ก่อน deploy และแนะนำให้ใช้กับ database migrations โดยตรง หากขั้นตอนนี้ล้มเหลว deploy จะล้มเหลวและ service รุ่นล่าสุดที่สำเร็จจะยังทำงานต่อ ([Render: deploy steps and pre-deploy command](https://render.com/docs/deploys#deploy-steps)). Prisma แนะนำให้รัน `migrate deploy` ใน CI/CD แทนการนำ production URL มาใช้จากเครื่องนักพัฒนา ([Prisma: deploy database changes](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)).

ต้องแน่ใจว่า Prisma CLI ยังมีอยู่ใน build artifact ตอน Pre-Deploy ทำงาน เพราะโปรเจกต์วาง `prisma` ไว้ใน `devDependencies`; Prisma เตือนว่า platform ที่ตัด dev dependencies ทิ้งจะเรียก `migrate deploy` ไม่ได้ หาก Render build ถูกตั้งให้ติดตั้ง production dependencies เท่านั้น ต้องปรับ build ให้ติดตั้ง dev dependencies หรือย้าย Prisma CLI ไป `dependencies` ([Prisma: deploy database changes](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)).

### 3. ถ้าใช้ Render Free web service

Render ให้ใช้ Pre-Deploy Command เฉพาะ paid web service, private service และ background worker ([Render: pre-deploy availability](https://render.com/docs/deploys#pre-deploy-command)). ตัวเลือกเรียงตามความเหมาะสมคือ:

1. อัปเกรด web service เป็น paid แล้วใช้ Pre-Deploy Command ซึ่งแยก migration ออกจาก process ของแอปชัดเจนที่สุด
2. ให้ GitHub Actions รัน `pnpm exec prisma migrate deploy` แล้วตั้ง Render Auto-Deploy เป็น **After CI Checks Pass**; Render รองรับการรอ CI checks ก่อน deploy ([Render: configuring auto-deploys](https://render.com/docs/deploys#configuring-auto-deploys)) และ Prisma มีตัวอย่างการ deploy migration ด้วย GitHub Actions อย่างเป็นทางการ ([Prisma: GitHub Actions migration example](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate#deploying-database-changes-using-github-actions))
3. สำหรับระบบทดลองที่มี instance เดียว อาจใช้ Start Command แบบ `pnpm exec prisma migrate deploy && pnpm run start:prod` เป็น fallback ได้ แต่ต้องยอมรับว่า migration ผูกกับ startup ของแอป และยังต้องออกแบบ migration ให้ backward-compatible เพราะ instance เก่ายังรับ traffic ระหว่างที่ instance ใหม่เริ่มทำงาน

Free Render Postgres ไม่มี backup หรือ recovery และหมดอายุหลัง 30 วัน จึงไม่เหมาะกับ production ตามเอกสาร Render ([Render: Free Postgres limitations](https://render.com/docs/free#free-postgres)).

## คำสั่งใดใช้ที่ไหน

| งาน | Development | Staging / Production |
|---|---|---|
| สร้าง migration จาก schema ที่แก้ | `prisma migrate dev --name ...` | ห้าม |
| Apply migration ที่ commit แล้ว | ทำได้ผ่าน `migrate dev` | `prisma migrate deploy` |
| ตรวจสถานะ | `prisma migrate status` | `prisma migrate status` |
| Reset ข้อมูล | `prisma migrate reset` เฉพาะฐานที่ทิ้งได้ | ห้าม |
| Prototype schema เร็ว ๆ | `prisma db push` เฉพาะฐานชั่วคราว | ห้ามเป็น workflow ปกติ |
| Seed ข้อมูลทดสอบ | ทำได้ | ไม่รันทุก deploy |

`db push` ไม่สร้าง migration file และไม่อัปเดต `_prisma_migrations`; หากมีการเปลี่ยนแปลงที่เสี่ยงข้อมูลสูญหายจะต้องใช้ `--accept-data-loss` จึงเหมาะกับการ prototype มากกว่าการส่ง schema ข้าม environment ([Prisma: prototyping with `db push`](https://docs.prisma.io/docs/orm/v6/prisma-migrate/workflows/prototyping-your-schema), [Prisma: `db push`](https://www.prisma.io/docs/cli/db/push)).

ไม่ควรนำ `prisma:seed` ไปรวมใน Pre-Deploy ทุกครั้ง เพราะ seed ของ repo เป็นข้อมูลตั้งต้น/ข้อมูลจำลองและอาจสร้างข้อมูลซ้ำหรือแก้ข้อมูลจริง หากมี master data ที่จำเป็นใน production ควรทำเป็น idempotent data migration แยกต่างหาก ส่วนงาน one-time initialization บน Render มี `initialDeployHook` ซึ่งต่างจาก `preDeployCommand` ที่รันทุก deploy ([Render Blueprint: `initialDeployHook` and `preDeployCommand`](https://render.com/docs/blueprint-spec)).

## Zero-downtime และ backward-compatible migration

Render zero-downtime deploy จะให้ instance เก่ารับ traffic ต่อระหว่าง build/start instance ใหม่ แล้วค่อยสลับ traffic; หลังสลับแล้วยังรอ 60 วินาทีก่อนส่ง `SIGTERM` ให้ instance เก่า ([Render: zero-downtime sequence](https://render.com/docs/deploys#zero-downtime-deploys)).

ข้อสรุปจากลำดับนี้คือ เมื่อ Pre-Deploy เปลี่ยน shared database แล้ว backend รุ่นเก่ายังอาจกำลัง query ฐานข้อมูลอยู่ migration ต้องรองรับทั้งโค้ดรุ่นเก่าและใหม่พร้อมกันชั่วคราว

ตัวอย่างการเปลี่ยนชื่อ `old_column` เป็น `new_column` อย่างปลอดภัย:

1. **Expand release:** เพิ่ม `new_column` แบบ nullable หรือมี safe default โดยยังไม่ลบ `old_column`
2. **Compatible app release:** ปรับโค้ดให้อ่านค่าใหม่โดย fallback ค่าเก่า และเขียนทั้งสองคอลัมน์ถ้าจำเป็น
3. **Backfill:** ย้ายข้อมูลเก่าไปคอลัมน์ใหม่แบบ retry ได้และตรวจจำนวน/ความถูกต้อง
4. **Switch release:** ให้โค้ดใช้คอลัมน์ใหม่เพียงตัวเดียว แล้วรอจน instance เก่าหมดจากระบบ
5. **Contract release:** ค่อยสร้าง migration อีกชุดเพื่อลบ `old_column` หรือเพิ่ม `NOT NULL`

Prisma เรียกแนวทางนี้ว่า expand-and-contract: เพิ่มโครงสร้างใหม่และคัดลอกข้อมูลก่อน แล้วลบโครงสร้างเก่าหลังไม่มีโค้ดใดอ่านอีกต่อไป ([Prisma 7: expand-and-contract migrations](https://www.prisma.io/docs/guides/v7/database/data-migration)).

การเพิ่มคอลัมน์ nullable/ตาราง/index โดยไม่ทำให้ query เดิมพังมัก deploy รอบเดียวได้ แต่การ rename/drop column, เปลี่ยน type, เพิ่ม `NOT NULL` ให้ข้อมูลเดิม หรือ backfill ข้อมูลจำนวนมาก ควรแยกหลาย release และทดสอบบน staging ที่มีข้อมูลใกล้ production ก่อน

## การรับช่วง production database เดิมครั้งแรก

ก่อนเปิด Pre-Deploy Command ให้ทำตาม decision path นี้:

1. สร้าง backup หรือ PITR checkpoint ที่กู้คืนได้
2. ใช้ production connection ผ่าน environment ที่ปลอดภัย แล้วรัน `pnpm exec prisma migrate status`
3. ตรวจ `_prisma_migrations` ว่ามี history ตรงกับโฟลเดอร์ `prisma/migrations`
4. ทดสอบ `migrate deploy` บน staging/copy ของ production ก่อน โดยเฉพาะ migration ที่มี `DROP`

ผลที่อาจพบ:

- **History ตรงและไม่มี pending migration แปลก:** เปิด Pre-Deploy ได้
- **มี pending migration ที่ตั้งใจ deploy:** review SQL, backup, ทดสอบ staging แล้วจึง deploy
- **Schema มีอยู่แล้วแต่ `_prisma_migrations` ว่าง/ไม่มี เพราะเคยใช้ `db push`:** ห้ามรัน `migrate deploy` ตรง ๆ; ต้อง baseline ฐานเดิมเพื่อบอก Prisma ว่าโครงสร้างปัจจุบันถูก apply แล้ว Prisma ระบุว่า baselining ใช้กับฐานที่มีข้อมูลสำคัญและยังไม่เคยใช้ Prisma Migrate เพื่อป้องกันไม่ให้ migration เริ่มต้นพยายามสร้างตารางที่มีอยู่แล้ว ([Prisma 7: baselining](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining))
- **มี drift จาก manual SQL:** reconcile schema และ migration history ก่อน ไม่ควร reset production; Prisma อธิบายการใช้ `migrate resolve`, `migrate diff` และ `db execute` สำหรับ hotfix/failed migration ([Prisma: patching and hotfixing](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing))

เนื่องจาก repo มี migration เก่าแบบ destructive การ baseline ต้องเลือกจุดให้ตรงกับ schema production จริง ไม่ควรเดาว่าทุก migration apply แล้ว การทำส่วนนี้ควรมี backup, ตรวจ SQL และ dry-run กับสำเนาฐานข้อมูลก่อนเสมอ

## Backup, rollback และ recovery

### App rollback ไม่เท่ากับ database rollback

Render rollback นำ build artifact และ config บางส่วนของ deploy เก่ากลับมา แต่ไม่ได้ระบุว่าจะย้อน PostgreSQL/data ดังนั้น migration ที่ apply สำเร็จแล้วต้องถือว่ายังคงอยู่ ([Render: Rollbacks](https://render.com/docs/rollbacks)). ผลคือ:

- ถ้า migration เป็น additive/backward-compatible สามารถ rollback app ได้ง่าย เพราะโค้ดเก่ายังทำงานกับ schema ใหม่ได้
- ถ้า migration ลบ/rename สิ่งที่โค้ดเก่าต้องใช้ การ rollback app เพียงอย่างเดียวอาจทำให้ระบบพัง
- การย้อน schema ปกติควรทำเป็น compensating/forward migration ที่ review แล้ว ไม่ควรลบ migration file เก่าหรือแก้ migration ที่เคย apply

### Render Postgres backup

- Paid Render Postgres มี continuous backup สำหรับ PITR; recovery window คือ 3 วันบน Hobby workspace และ 7 วันบน Pro ขึ้นไป
- PITR สร้าง database instance ใหม่เพื่อให้ตรวจสอบก่อนสลับ application ไปใช้ connection string ใหม่
- Logical backup export ถูกเก็บ 7 วัน; สามารถดาวน์โหลดเพื่อเก็บระยะยาว
- Free Render Postgres ไม่มี recovery หรือ managed backup; Render ระบุว่าสามารถใช้ `pg_dump` เองได้

รายละเอียดทั้งหมดอยู่ที่ [Render Postgres Recovery and Backups](https://render.com/docs/postgresql-backups). สำหรับเหตุข้อมูลสูญหาย Render แนะนำ PITR มากกว่า logical restore เพราะโดยทั่วไปกู้ได้ใกล้เวลาปัจจุบันกว่า และ logical restore ควรลงฐานข้อมูลว่าง

### เมื่อ migration ล้มเหลว

1. หยุด auto-deploy ชั่วคราวและตรวจ `prisma migrate status`
2. อ่าน error และดูว่าการเปลี่ยนแปลงใดเกิดขึ้นแล้ว
3. เลือกอย่างใดอย่างหนึ่งตามสภาพจริง:
   - แก้/ย้อนสิ่งที่ทำไป แล้วใช้ `prisma migrate resolve --rolled-back <migration>` ก่อน deploy migration ที่แก้แล้ว
   - ทำ migration ให้ครบด้วยมืออย่างควบคุม แล้วใช้ `prisma migrate resolve --applied <migration>`
4. ถ้าเกิด data loss ให้ restore ไป database instance ใหม่ด้วย PITR แล้วทดสอบก่อนสลับ connection

`migrate resolve` มีไว้จัดสถานะ failed migration/baseline/hotfix ไม่ใช่คำสั่ง rollback data โดยอัตโนมัติ ([Prisma: `migrate resolve`](https://www.prisma.io/docs/cli/migrate/resolve)).

## Checklist ใช้งานประจำ

### การเปลี่ยน feature ที่ไม่แตะ database

- แก้โค้ดและทดสอบ
- push/merge branch ที่ Render ติดตาม
- `migrate deploy` จะไม่พบ pending migration และจบโดยไม่เปลี่ยน schema

### การเปลี่ยน feature ที่แตะ database

- แก้ Prisma schema
- สร้าง migration ด้วย `migrate dev`
- review SQL โดยเฉพาะ `DROP`, rename, type change, `NOT NULL`, index บนตารางใหญ่
- ทดสอบ migration กับข้อมูลจำลองหรือ staging
- commit schema + migration + compatible application code
- backup ก่อน migration ที่มีความเสี่ยง
- push/merge แล้วให้ Render Pre-Deploy apply อัตโนมัติ
- ตรวจ deploy log, health check และ error rate หลังปล่อย

### Policy ที่ควรยึด

- Production ใช้ `migrate deploy` เท่านั้นสำหรับ routine schema deployment
- Production ไม่ reset และไม่ `db push`
- Migration ที่ commit แล้วและเคย apply ห้ามแก้ย้อนหลัง
- Seed ไม่รันทุก deploy
- Destructive change แบ่งเป็น expand/backfill/contract
- App rollback และ DB recovery เป็นคนละกระบวนการ
- ใช้ Render overlapping deploy policy แบบ **Wait** เพื่อลดโอกาสยกเลิก deploy ขณะ migration กำลังทำงาน; Render แนะนำ Wait สำหรับ workspace ส่วนใหญ่ ([Render: handling overlapping deploys](https://render.com/docs/deploys#handling-overlapping-deploys))

## ข้อเสนอขั้นต่อไปสำหรับ repo นี้

งาน implementation ควรแยกเป็นอีก change set หลังจากยืนยันสถานะ production database แล้ว:

1. เพิ่ม `prisma:deploy` และ `prisma:status` ใน `package.json`
2. เพิ่ม `render.yaml` หรือบันทึก Render Dashboard commands เป็น source-controlled deployment documentation
3. ตั้ง Pre-Deploy Command เป็น `pnpm run prisma:deploy`
4. ตั้ง Auto-Deploy เป็น After CI Checks Pass
5. เพิ่ม CI ที่ build/test และตรวจ migration SQL ก่อน Render deploy
6. สร้าง staging database หรือสำเนาข้อมูลที่ anonymize แล้วสำหรับ rehearsal migration
7. เปิด PITR/backup ให้เหมาะกับความสำคัญของข้อมูลโรงพยาบาล

ไม่ควรทำข้อ 1-3 กับ production จนกว่าจะยืนยันว่า migration history ตรงกันหรือทำ baseline สำเร็จ โดยเฉพาะเมื่อ history ปัจจุบันมีไฟล์ `reset_database` ที่ destructive
