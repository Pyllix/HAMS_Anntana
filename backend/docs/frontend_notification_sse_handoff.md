# คู่มือส่งต่อ Dev FE: Notification ผ่าน SSE

วันที่: 2026-10-13

สถานะ: BE implementation ของ Ticket 01 มี schema/migration, GET รายการ/จำนวนยังไม่อ่าน, SSE และเหตุการณ์คำขอยืมรออนุมัติแล้ว; integration test ยังรอฐาน PostgreSQL ทดสอบจริง ส่วนการอ่านแจ้งเตือนและเหตุการณ์ยืม/ซ่อมรายการอื่นอยู่ใน Ticket ถัดไป

## SSE คืออะไร

FE เปิด HTTP connection หนึ่งเส้นไป BE แล้วรอรับข้อมูลใหม่ต่อเนื่อง BE ส่งเหตุการณ์ผ่านเส้นนี้เมื่อมีแจ้งเตือน ไม่ต้องเปิด connection ใหม่ทุก notification

Browser มี EventSource สำหรับงานนี้อยู่แล้ว ใช้ addEventListener รับ event ที่มีชื่อ และปิดด้วย close() ดู [MDN: EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

งาน notification ใช้สองช่องทางร่วมกัน:
- REST API โหลดรายการย้อนหลัง/จำนวน และส่งการอ่าน
- SSE แจ้งว่ามีข้อมูลใหม่หรือสถานะอ่านเปลี่ยน ให้ FE อัปเดตหน้าจอ

## หน้าที่ของแต่ละฝั่ง

BE สร้างข้อความ เลือกผู้รับ เก็บข้อมูล ป้องกันแจ้งซ้ำ คำนวณใกล้คืน/เกินกำหนด และเก็บสถานะอ่านรายคน

FE แสดงกระดิ่ง badge รายการและข้อความ เวลา สถานะอ่าน และเปิดหน้างานที่เกี่ยวข้อง จัดการการเชื่อมต่อเมื่อ login/logout หรือ component ถูกถอด

FE ไม่สร้างเหตุการณ์ยืม/ซ่อมซ้ำ ไม่ตัดสินผู้รับจาก role ไม่คำนวณเวลาส่งแจ้งเอง และไม่ใช้ข้อมูลใน browser แทนข้อมูลจริงจาก BE

## API ที่ FE จะใช้

ใช้ API base URL จาก configuration เดิม ไม่ hardcode localhost

| Endpoint | สถานะ / การใช้งาน |
| --- | --- |
| GET /notifications?page=1&limit=20 | พร้อมใช้: รายการพร้อม pagination meta; `limit` สูงสุด 100 |
| GET /notifications/unread-count | พร้อมใช้: จำนวนยังไม่อ่านจาก BE |
| GET /notifications/stream | พร้อมใช้: เปิด EventSource ของผู้ใช้ที่ login |
| PATCH /notifications/:id/read | Ticket 02: ทำเครื่องหมายอ่านรายการนั้น ส่ง body ว่าง |
| PATCH /notifications/read-all | Ticket 02: อ่านทั้งหมด ส่ง body ว่าง |

- REST ใช้ API client เดิมที่ส่ง session cookie และ CSRF header สำหรับ PATCH
- SSE ใช้ EventSource พร้อม withCredentials: true เมื่อเรียกข้าม origin และ BE ต้องอนุญาต origin/cookies ตามการตั้งค่าจริง
- ไม่ส่ง userId เพื่อเลือกกล่องแจ้งเตือนเอง และไม่ใส่ session token ใน URL
- badge ใช้ unread-count จาก BE ไม่ใช่จำนวนรายการที่โหลดมาในหน้าแรก

## Payload ที่ใช้แสดง

| Field | ความหมาย |
| --- | --- |
| id | ใช้เป็น key และกันข้อมูลซ้ำ |
| type | ชนิดเหตุการณ์ธุรกิจ |
| title / message | ข้อความพร้อมแสดงจาก BE |
| resourceType / resourceId | รายการที่เกี่ยวข้อง ใช้กับ mapping หน้าของ FE |
| readAt | null = ยังไม่อ่าน; timestamp = อ่านแล้ว |
| createdAt | เวลาเกิดแจ้งเตือนในรูป ISO timestamp |

resourceType มี BORROW_TRANSACTION, BORROW_EXTENSION และ REPAIR_JOB ใช้เส้นทางหน้าจอที่มีอยู่จริงของ FE อย่าใช้ BorrowExtension id แทน BorrowTransaction id

เก็บเวลาเป็น timestamp และแสดงตาม Asia/Bangkok ไม่มีงานเปลี่ยนความหมายวันคืนในงานนี้

## SSE events ที่ต้องรับ

| ชื่อ SSE event | สถานะ / FE ทำอะไร |
| --- | --- |
| notification.created | พร้อมใช้: มีแจ้งเตือนใหม่ที่บันทึกแล้ว; อัปเดตรายการ/จำนวนและกันซ้ำด้วย id |
| notifications.sync_required | พร้อมใช้: โหลดรายการและจำนวนล่าสุดเมื่อเชื่อมต่อหรือ reconnect |
| heartbeat | พร้อมใช้: รับแล้วไม่เพิ่มรายการ ไม่เพิ่ม badge และไม่แสดง toast |
| notifications.changed | Ticket 02: โหลดรายการและจำนวนใหม่เมื่อสถานะอ่านเปลี่ยนจากอีกแท็บ/อุปกรณ์ |

ขณะนี้ชนิดเหตุการณ์ที่สร้างจริงคือ `BORROW_APPROVAL_REQUIRED` เมื่อคำขอยืมแบบรออนุมัติสำเร็จ ผู้รับคือเจ้าหน้าที่ Asset Center ที่บัญชีใช้งานได้ เหตุการณ์อนุมัติยืม/ต่ออายุ งานซ่อม และการเตือนวันคืนจะตามมาใน Ticket 03–05

ชื่อ SSE event ไม่ใช่ payload.type เช่น BORROW_APPROVED อยู่ใน type ของข้อมูล แต่ส่งผ่านชื่อ notification.created เหมือน notification ใหม่ชนิดอื่น ต้องใช้ addEventListener สำหรับชื่อในตาราง ไม่ใช้ onmessage เพียงตัวเดียว ดู [MDN: named SSE events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)

## วิธีเริ่มแบบง่าย

เริ่มด้วยการรับสาม events แล้ว invalidate/refetch รายการกับ count ผ่าน query client เดิม ยังไม่ต้องทำ cache แบบเพิ่ม/ลบข้อมูลเองหรือทำ toast

1. หลัง login และ session พร้อม เปิด EventSource หนึ่งตัวใน authenticated app layout/root ต่อหนึ่งแท็บ
2. เตรียม list/count queries แยก cache ตาม userId ดึงข้อมูลเมื่อเริ่มใช้งานหรือได้รับ sync_required
3. เมื่อรับ created/changed ให้ invalidate ทั้งรายการและ count
4. ให้ API response เป็นข้อมูลหลัก แทนการนำ snapshot เก่ามาบวกยอดเอง
5. หลัง PATCH read/read-all สำเร็จ ให้ invalidate ในแท็บที่กดเองด้วย อย่ารอ SSE อย่างเดียว
6. Logout, เปลี่ยนบัญชี หรือ unmount ให้ close() และล้าง cache ของบัญชีเก่า
7. เริ่มต้นไม่ต้องเพิ่ม Socket.IO หรือระบบ reconnect อีกชุด

ตัวอย่าง helper ขั้นต้นสำหรับเชื่อมต่อ ไม่ใช่โค้ดที่นำไปแก้ FE แล้ว:

```javascript
function connectNotificationStream(apiBaseUrl, refreshNotifications) {
  const base = apiBaseUrl.replace(/\/$/, "");
  const source = new EventSource(base + "/notifications/stream", {
    withCredentials: true,
  });

  source.addEventListener("notification.created", refreshNotifications);
  source.addEventListener("notifications.changed", refreshNotifications);
  source.addEventListener("notifications.sync_required", refreshNotifications);

  // ใช้ฟังก์ชันนี้ใน cleanup เมื่อ logout, เปลี่ยนผู้ใช้ หรือ unmount
  return () => source.close();
}
```

refreshNotifications เป็น callback ของ FE ที่ invalidate list/count queries ของ user ปัจจุบัน; หากใช้ React effect ให้ callback/base URL/user identity เสถียร เพื่อไม่เปิด stream ใหม่ทุก render และเรียก cleanup ของ connection เก่าก่อนเปิดใหม่

## หลุดและหมด session

EventSource พยายาม reconnect อัตโนมัติหลังการขาดการเชื่อมต่อที่สามารถ retry ได้ ดู [MDN: closing and reconnecting SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)

- การ reconnect ไม่ได้รับประกันว่าจะได้ทุก frame ที่พลาด ให้โหลดข้อมูลจริงเมื่อได้ sync_required
- ไม่แสดงประวัติทั้งหมดเป็น toast ตอน initial load หรือ reconnect
- SSE error บอกไม่ได้เองเสมอว่าเป็น 401 อย่าถือว่าหลุดทุกครั้งคือ logout ใช้ session lifecycle/check เดิมของแอป
- ถ้ายืนยันว่า session หมดอายุหรือ logout แล้ว ให้ปิด stream และกลับสู่ flow login เดิม
- ถ้าเครือข่ายขาดชั่วคราว อาจแสดงสถานะกำลังเชื่อมต่อใหม่ แต่ไม่ล้างรายการที่โหลดไว้เพียงเพราะ stream ขาด
- SSE background traffic และ heartbeat ไม่ถือเป็นการใช้งานที่ต่ออายุ session

## สิ่งที่ต้องปรับจาก FE ปัจจุบันเมื่อถึงงานเชื่อมต่อ

จากการตรวจ FE เดิมมีข้อมูล notification ตัวอย่าง, read state ใน browser storage และตัวสร้างข้อความจาก repair workflow

- เปลี่ยน list/count/read operations ให้ใช้ BE ตาม contract
- หยุดสร้างข้อความจริงซ้ำจาก workflow ใน FE สำหรับเหตุการณ์ที่ BE ส่งมา
- ย้ายจาก isRead ของข้อมูลเก่ามาใช้ readAt หรือ adapter ที่แปลงจาก readAt
- ใช้ id จาก BE ไม่สร้าง id ใหม่เมื่อรับข้อความ
- ไม่ filter ผู้รับจาก recipientRole เพราะ API ส่งเฉพาะข้อมูลของเจ้าของ session แล้ว
- แยก query cache ตามบัญชี และล้างข้อมูลตัวอย่าง/ข้อมูลบัญชีเดิมไม่ให้ปนกับรายการจริง
- สามารถเก็บ UI components เดิมไว้แล้วเปลี่ยน data source ไม่จำเป็นต้องรื้อหน้าใหม่

## เกณฑ์ตรวจ FE

- เปิดหน้าแล้วรายการและ badge ตรงกับ BE แม้จำนวนแจ้งเตือนมากกว่า page size
- เกิด notification ใหม่แล้วอัปเดตโดยไม่ต้อง reload หน้า
- อ่านแล้ว/read-all แล้ว API ถูกเรียก และอีกแท็บ refresh read state ได้
- Network หลุดแล้วกลับมา รายการและจำนวนล่าสุดกลับมาถูกต้อง ไม่เพิ่มข้อความ/ยอดซ้ำ
- heartbeat ไม่แสดงเป็นแจ้งเตือน และ initial history ไม่เด้งเป็น toast ทั้งหมด
- Logout/เปลี่ยนบัญชีไม่มี stream หรือ cache ของบัญชีเดิมเหลือ
- Component rerender/route change ไม่ทำให้มี stream ซ้อนโดยไม่มี cleanup
- การคลิก notification ไปยังหน้าที่มีอยู่จริงตาม resourceType/resourceId และอ่านสถานะปัจจุบันจาก API ของงานนั้น

ไม่มีการส่งข้อความให้ทีมอื่นหรือแก้ code FE ในการจัดทำคู่มือนี้
