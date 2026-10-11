# การประเมิน Logging และบทบาทของ Winston, Morgan, CloudWatch

ตรวจเอกสารวันที่ 2026-10-05 ขอบเขต: แนวทางจากเอกสารเจ้าของโครงการและบริการ ไม่ใช่การรับรอง compliance ของระบบที่ deploy จริง

## เกณฑ์ที่ใช้ประเมิน

OWASP แนะนำให้บันทึกเหตุการณ์สำคัญ เช่น authentication, authorization failure, application error และการบริหารผู้ใช้ พร้อมข้อมูลเวลา ต้นทาง ผู้กระทำ ประเภทเหตุการณ์ ผลลัพธ์ และ interaction identifier เพื่อเชื่อมเหตุการณ์ในคำขอเดียวกัน ป้องกัน log injection/การรั่วของ secret และมีการจำกัดสิทธิ์ การเฝ้าระวังและ retention ตามนโยบาย จึงควรประเมินจากคุณภาพและการใช้งาน log มากกว่าชื่อ library ([OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)).

## เปรียบเทียบเครื่องมือ

| เครื่องมือ | บทบาท | สิ่งที่ช่วยได้ | สิ่งที่ยังต้องออกแบบ |
|---|---|---|---|
| Nest Logger / ConsoleLogger | สร้าง application log | ระดับ log, context, JSON, custom LoggerService | schema, request context, redaction, security events, ที่เก็บส่วนกลาง |
| Winston | สร้างและส่ง application log | JSON/format, metadata, severity, transports หลายปลายทาง, flush | HTTP lifecycle, correlation, redaction, retention และ alert ของปลายทาง |
| Morgan | HTTP request middleware | method, status, URL, timing, custom tokens/format และ output stream | business/security event, app error details, sensitive URL policy, ที่เก็บและ alert |
| CloudWatch Logs | รวบรวม เก็บ ค้นหา และติดตาม log ส่วนกลาง | Logs Insights, JSON field discovery, log-group retention/access settings, metric filters | แอปต้องสร้าง log ที่มีบริบทและส่งเข้า service; ตั้ง IAM, retention, alarm และ ingestion |

แหล่งอ้างอิง: [Nest Logger](https://docs.nestjs.com/techniques/logger), [Winston README](https://github.com/winstonjs/winston), [Morgan docs](https://expressjs.com/en/resources/middleware/morgan/), [CloudWatch concepts](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CloudWatchLogsConcepts.html), [Logs Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html).

ข้อสรุปจากบทบาทในเอกสาร: เครื่องมือทั้งสามเป็นคนละชั้นและใช้ร่วมกันได้ ไม่ใช่ตัวแทนกัน การติดตั้งทั้งสามไม่ทำให้ได้ logging ที่เหมาะสมโดยอัตโนมัติ

## จุดที่ต้องระวังในการใช้จริง

- **Structured log:** ใช้ JSON หนึ่ง event ต่อหนึ่งบรรทัดและ schema คงที่ เพื่อค้นตาม field แทนการอ่านข้อความยาว CloudWatch Logs Insights สามารถค้นพบ field จาก JSON application log ได้ ([Logs Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html)).
- **Correlation:** ส่ง `requestId` ตั้งแต่รับคำขอถึง access log, service/error log และ audit event; ห้ามใช้ session token เป็น requestId แนวทางนี้เป็นข้อเสนอการออกแบบจาก interaction identifier ของ OWASP ([OWASP event attributes](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#event-attributes)).
- **Sensitive data:** อย่าเก็บ password, token, cookie/session credential, connection string, OTP/TOTP secret หรือข้อมูลส่วนตัวทั้งหมดใน request body/URL ใช้ allowlist ของ field และ sanitize ข้อมูลภายนอกก่อนเขียน ([OWASP data to exclude](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude), [OWASP event collection](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#event-collection)).
- **HTTP timing:** Morgan `response-time` วัดจนเขียน response headers; `total-time` วัดจนจบ response ส่วน `immediate: true` เขียนตอนรับ request จึงไม่มี response status ถ้าต้องใช้ตรวจ 5xx ต้องบันทึกตอนจบหรือมี completion event เพิ่ม ([Morgan tokens/options](https://expressjs.com/en/resources/middleware/morgan/)).
- **Winston production:** ค่า default threshold เป็น `info` และ `http` อยู่ต่ำกว่า `info` หากส่ง access log ด้วย `logger.http` ต้องตั้ง level/transport ให้รับระดับนั้นด้วย จัดการ logger error และรอ flush ก่อนปิด process ตามเอกสาร ([Winston levels and flush](https://github.com/winstonjs/winston)).
- **CloudWatch:** default retention คือเก็บตลอดไป ควรกำหนด policy ตามความต้องการ ไม่กำหนดจำนวนวันเองโดยอ้างว่าทุกระบบต้องเหมือนกัน ใช้ metric filters ร่วม CloudWatch alarm เพื่อตรวจเหตุการณ์สำคัญ ([CloudWatch overview](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html), [Metric filters](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/MonitoringLogData.html)).
- **Masking:** CloudWatch data protection เป็นการป้องกันเพิ่มที่ปลายทาง ไม่แทนการลบ secret ในแอป เอกสารระบุว่าไม่ย้อนหลังไป mask log ที่ ingest ก่อนตั้ง policy ([CloudWatch data protection](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/mask-sensitive-log-data.html)).

## ข้อเสนอสำหรับ HAMS

ข้อเสนอต่อไปนี้เป็นการตีความเอกสารให้เข้ากับโครงการ โดยมีผลตรวจ implementation ในส่วนถัดไป แต่ยังไม่ได้ตรวจ deployment จริง

1. เริ่มจาก application logger เดียว มี JSON output, severity, context และ redaction ที่ทุกโมดูลใช้ร่วมกัน จะใช้ Nest ConsoleLogger หรือ Winston ก็ได้; Winston เหมาะเมื่อจำเป็นต้องมี formatting/transports และ metadata ที่ปรับแต่งมากขึ้น ([Nest custom logger](https://docs.nestjs.com/techniques/logger), [Winston](https://github.com/winstonjs/winston)).
2. เก็บ HTTP completion log ด้วย middleware หรือ Morgan ให้ครอบคลุม error/guard rejection พร้อม method, route/path ที่ลบ query secret แล้ว, status, duration, requestId โดยไม่ dump request body; แยก application/security events จาก access log ([Morgan](https://expressjs.com/en/resources/middleware/morgan/), [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)).
3. เก็บเหตุการณ์ login/2FA failure, authorization denial, reset password, เปลี่ยน role และ recovery ใน security audit; ประวัติยืม/โอน/ซ่อมที่อยู่ในตารางธุรกิจช่วยตรวจธุรกรรม แต่ไม่ได้ครอบคลุมเหตุการณ์ security โดยอัตโนมัติ ([OWASP events](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#which-events-to-log)).
4. ส่ง stdout/stderr ให้ hosting/collector รวบรวม ตั้ง retention, จำกัดสิทธิ์ และ alert ก่อนเพิ่มปลายทางหลายแห่ง ถ้าใช้ AWS ECS สามารถส่งผ่าน `awslogs` driver เข้า CloudWatch ได้โดยตรง ([ECS awslogs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html)).
5. ถ้า deploy บน Render ตามแผนใน `TASK.md` ใช้ runtime logs และ log streaming ที่รองรับก่อน CloudWatch เป็นทางเลือกเมื่อทีมต้องการ AWS เป็นที่เก็บกลาง ไม่จำเป็นต้องย้าย app ไป AWS แต่ต้องวางเส้นทาง ingestion เพิ่ม Render มี retention และ HTTP request logs ตาม workspace plan จึงต้องตรวจ plan/config จริง ([Render logging](https://render.com/docs/logging), [Render log streams](https://render.com/docs/log-streams)).

**ข้อจำกัดเวอร์ชัน:** `package.json` ของโครงการกำหนด Nest 11 และ installed `ConsoleLoggerOptions` มี `json?: boolean` แต่ไม่มี `structuredParams`/`flattenParams` เอกสาร Nest ปัจจุบันระบุ structured params เริ่มใน v12 จึงไม่ควรคัดลอกตัวอย่าง v12 มาใช้ใน HAMS โดยไม่ตรวจ version การเปิด JSON และการใช้ custom LoggerService ยังเป็นแนวทางที่ใช้ประเมินได้ ([Nest structured logging params](https://docs.nestjs.com/techniques/logger#structured-logging-params)).

## ผลตรวจ repository ประกอบการประเมิน

ข้อมูลส่วนนี้มาจาก agent ที่ตรวจ source code ในงานเดียวกัน เป็นหลักฐานใน repository ไม่ใช่ข้อความจากเอกสารภายนอก

| พบในโค้ด | ความหมายต่อการประเมิน |
|---|---|
| `src/main.ts` ใช้ NestFactory logger ปริยาย และไม่พบ JSON logger, HTTP access middleware หรือ requestId ส่วนกลาง; `package.json` ไม่มี Winston, Morgan หรือ AWS logging integration | มี application logging พื้นฐาน แต่ยังขาด schema และ correlation ที่ใช้สืบปัญหาคำขอได้สม่ำเสมอ |
| Users service ใช้ `recordSecurityAudit` เขียน `tx.securityAuditLog` พร้อม actor/target/action/details ภายใน transaction สำหรับ create/change role/disable/enable/delete/restore/reset password/reset 2FA | เป็นจุดแข็งของ audit ฝั่งบริหารผู้ใช้; ต้องรักษาไว้แม้เปลี่ยน application logger |
| `src/auth/two-factor.service.ts:526` ใช้ `console.warn` สำหรับ lockout; sign-in expected failures เขียน warn เมื่อเปิด `AUTH_DB_DIAGNOSTICS=1`; ไม่พบ persistent audit ของ authentication และ RolesGuard ไม่มี audit denial โดยตรง | authentication/authorization audit ยังไม่ครอบคลุมและไม่ควรขึ้นกับ debug flag |
| Mail service log email ตรงและ raw error objects; forecast service:576–604 นำ provider `errorText` มาไว้ใน error message ที่ถูก log | มีความเสี่ยงบันทึกข้อมูลส่วนตัวหรือรายละเอียดจากภายนอกเกินความจำเป็น ควรทำ field allowlist และ redaction |
| Image logger หลีกเลี่ยง provider details แต่ generic errors บางจุดไม่เก็บ cause | เป็นแนวทางลด leakage ที่ดี แต่ควรมี safe error code/cause category เพื่อสืบปัญหา |
| ไม่ได้ตรวจ runtime logging infrastructure | ยังสรุปไม่ได้ว่าบน hosting มี retention, aggregation, alert หรือ access controls ครบหรือไม่; การไม่พบ config ใน repo ไม่ใช่หลักฐานว่า production ไม่มี |

**ข้อสรุป:** มีแนวปฏิบัติที่ดีบางส่วน โดยเฉพาะ audit ธุรกรรมบริหารผู้ใช้ แต่ยังมีช่องว่างสำคัญของ operational/security logging ก่อนจะเรียกว่าพร้อม production ตามเกณฑ์ OWASP ต้องเติม structured/correlated logs, HTTP completion logs, authentication/authorization audit และ redaction แล้วตรวจนโยบาย storage/retention/alert ของระบบจริง การติดตั้ง library ใดอย่างเดียวไม่ใช่การรับรองมาตรฐาน

**ข้อควรคุมตอนออกแบบ HTTP log:** middleware ระดับ HTTP ต้องครอบคลุม guard rejection และ direct BetterAuth routes ด้วย; Nest interceptor เพียงอย่างเดียวอาจไม่ได้เห็น request ทุกเส้นทางหรือคำขอที่ถูก guard ปฏิเสธ
