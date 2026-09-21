# สถาปัตยกรรมระบบแจ้งเตือนภายในแอปพลิเคชัน (In-App Notification Architecture)
### คู่มือการตัดสินใจทางสถาปัตยกรรม: Polling vs Server-Sent Events (SSE) vs WebSockets สำหรับระบบ HAMS

เอกสารนี้จัดทำขึ้นเพื่อเป็นแนวทางในการตัดสินใจเชิงสถาปัตยกรรม (Architectural Decision Record - ADR) สำหรับการพัฒนา **In-App Notification** ในระบบบริหารจัดการครุภัณฑ์โรงพยาบาล (HAMS) ครอบคลุมการแบ่งหน้าที่ระหว่าง Frontend และ Backend, การเปรียบเทียบเทคโนโลยี, และโร้ดแมปการพัฒนาเป็นรายเฟส

---

## 1. การแบ่งหน้าที่ระหว่าง Backend และ Frontend (Separation of Concerns)

ระบบแจ้งเตือนภายในแอปพลิเคชันที่มีประสิทธิภาพ **ต้องทำงานร่วมกันทั้งสองฝั่ง**:

```mermaid
graph TD
    subgraph Backend [Backend - Data & Decision Core]
        Event[Business Event เกิดขึ้น<br/>เช่น ช่างซ่อมเสร็จ, มีคนขอยืม] --> CreateNoti[สร้าง Notification Record ลง DB<br/>userId, title, message, link, isRead]
        CreateNoti --> DB[(PostgreSQL Database)]
        DB --> API[REST API / Stream Endpoints]
    end

    subgraph Frontend [Frontend - Presentation & Interaction]
        API --> ClientFetch[Client ดึงข้อมูล / ดักรับ Event<br/>(Polling หรือ SSE Listener)]
        ClientFetch --> UI_Bell[อัปเดตไอคอนกระดิ่ง 🔔<br/>+ Badge ตัวเลขสีแดง]
        ClientFetch --> UI_Toast[แสดง Toast เด้งมุมจอ 3-5 วินาที]
        UI_Bell --> ClickDrawer[เปิด Notification Drawer/List]
        ClickDrawer --> Navigate[คลิกรายการแจ้งเตือน<br/>-> นำทางไปยังหน้านั้นๆ ทันที]
        Navigate --> MarkRead[ยิง API มาร์กสถานะ isRead = true]
    end
```

---

## 2. การเปรียบเทียบเชิงลึก: Polling vs SSE vs WebSockets

| มิติการพิจารณา | Short Polling (10-15s) | Server-Sent Events (SSE) | WebSockets (Socket.io) |
| :--- | :--- | :--- | :--- |
| **ความหน่วงเวลา (Latency)** | หน่วงเล็กน้อย (0 - 15 วินาที) | **แทบเป็นศูนย์ (Real-time)** | **แทบเป็นศูนย์ (Real-time)** |
| **ทิศทางการส่งข้อมูล** | Request / Response ทั่วไป | ทางเดียว (Server -> Client) | สองทาง (Bi-directional) |
| **ความซับซ้อนในการพัฒนา** | **ง่ายที่สุด (ต่ำมาก)** | ปานกลาง (เขียน Stream ใน NestJS) | สูง (ต้องจัดการ State และ Room) |
| **ความเข้ากันได้กับเน็ตเวิร์ก รพ.** | **เสถียร 100%** ผ่าน Firewall/Proxy ได้ทุกแบบ | อาจมีปัญหา Connection Timeout จาก Proxy รพ. | มักถูกบล็อกโดย Enterprise Proxy/Firewall |
| **พฤติกรรมเมื่อเปิดหลายแท็บ** | ปกติ (แชร์ Cache ผ่าน React Query ได้) | ติดข้อจำกัด HTTP/1.1 (สูงสุด 6 ท่อต่อโดเมน) | เปลือง Connection ฝั่งเซิร์ฟเวอร์ |
| **การขยายระบบ (Horizontal Scaling)** | **ง่ายมาก** (Stateless รองรับ Load Balancer ทันที) | ต้องใช้ Redis Pub/Sub เพื่อ Broadcast ข้ามเครื่อง | ต้องใช้ Redis Adapter เพื่อ Sync ข้ามเครื่อง |
| **ความเหมาะสมกับ HAMS** | ⭐⭐⭐⭐⭐ **(แนะนำสูงสุดสำหรับเฟส 1)** | ⭐⭐⭐⭐ **(แนะนำสำหรับเฟส 2)** | ⭐⭐ (ซับซ้อนเกินความจำเป็น) |

---

## 3. เกณฑ์การตัดสินใจและข้อสรุปสำหรับระบบ HAMS (Verdict)

### 🏆 คำตัดสิน: เลือกใช้ "Smart Polling" เป็นทางเลือกหลักเริ่มต้น
1. **บริบทของโรงพยาบาล (Hospital Operational Context)**:
   * งานแจ้งซ่อม, งานยืม-คืน, และงานสอบเทียบเครื่องมือแพทย์ **ไม่ใช่งานที่ต้องการความฉับไวระดับเสี้ยววินาที (Sub-second latency)** เหมือนแอปแชทหรือระบบหุ้น
   * การที่พยาบาลแจ้งซ่อม แล้วช่างเห็นการแจ้งเตือนในอีก **5 - 15 วินาทีถัดไป ถือว่าเร็วเพียงพอสำหรับการปฏิบัติงานจริง**
2. **ความเข้ากันได้ของระบบเครือข่ายโรงพยาบาล (Enterprise Network Resilience)**:
   * เครือข่ายของโรงพยาบาลมักมี Corporate Firewall, Proxy, และ VPN ที่ตัดการเชื่อมต่อประเภท Long-lived Connection (เช่น SSE หรือ WebSocket) เมื่อไม่มีการเคลื่อนไหวเกิน 60 วินาที
   * Polling เป็นการยิง HTTP ธรรมดา จึงปลอดภัยจากปัญหา Connection หลุด
3. **ความคุ้มค่าและเวลาในการพัฒนา (Engineering Velocity & ROI)**:
   * สามารถใช้โครงสร้าง REST API เดิมของ NestJS ร่วมกับ `@tanstack/react-query` ในฝั่ง Frontend เขียนโค้ดเสร็จได้ภายในวันเดียว ดูแลง่าย และไม่มี Memory Leak

---

## 4. แผนงานการพัฒนาตามระยะเวลา (Phased Roadmap)

```
[ เฟส 1: เริ่มต้น (MVP) ] ─────────► [ เฟส 2: ยกระดับ (Real-time) ]
• Smart Polling (10-15s)            • เพิ่ม Server-Sent Events (SSE)
• ตาราง Notification ใน DB           • เฉพาะหน้า Dispatcher / งานวิกฤต
• React Query Window Focus          • สถาปัตยกรรม DB เดิม ไม่ต้องรื้อ
```

### เฟส 1: Smart Polling (แนะนำให้ทำตอนนี้)
* ใช้ช่วงเวลาการยิง: **10 - 15 วินาที**
* ใช้เทคนิค **Smart Polling**:
  * **Window Focus Refetch**: หยุดยิงเมื่อผู้ใช้สลับแท็บไปที่อื่น และยิงเช็กทันทีเมื่อสลับกลับมาที่หน้าเว็บ
  * **Lightweight Count Endpoint**: แยก Endpoint `GET /notifications/unread-count` ตอบกลับเฉพาะตัวเลข `{ count: 3 }` เพื่อให้ฐานข้อมูลใช้เวลา Query เพียง 1-2 ms

### เฟส 2: อัปเกรดเป็น Server-Sent Events (SSE) (พิจารณาในอนาคต)
* พิจารณาทำเมื่อ:
  * มีการพัฒนา **"กระดานเฝ้าระวังงานซ่อมด่วน (Emergency Dispatcher Board)"** ที่ต้องการให้มีเสียงแจ้งเตือนและเด้งทันที 0 วินาที
  * ปริมาณผู้ใช้งานพร้อมกัน (Concurrent Users) เพิ่มขึ้นเป็นหลักพันคน และเริ่มต้องการลด HTTP Request ที่ยิงเข้ามาเรื่อยๆ

---

## 5. การออกแบบฐานข้อมูลและ API (Technical Blueprint)

### 5.1 ตารางใน Prisma Schema (`prisma/schema/notification.prisma`)
```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  title     String   @db.VarChar(200)
  message   String   @db.Text
  type      NotificationType @default(GENERAL)
  link      String?  @db.VarChar(500) // URL หน้ารายละเอียด เช่น /repairs/job-123
  isRead    Boolean  @default(false) @map("is_read")
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead]) // Index สำคัญมากสำหรับการทำ Polling ที่เร็วระดับ 1-2 ms
  @@index([userId, createdAt])
  @@map("notifications")
}

enum NotificationType {
  GENERAL
  BORROW
  REPAIR
  PM_CALIBRATION
  SECURITY
}
```

### 5.2 รายการ REST API สำหรับระบบ Noti
1. `GET /notifications/unread-count`: ดึงเฉพาะจำนวนที่ยังไม่ได้อ่านสำหรับแสดง Badge บนกระดิ่ง
2. `GET /notifications?page=1&limit=20`: ดึงประวัติการแจ้งเตือนพร้อม Pagination
3. `PATCH /notifications/:id/read`: อัปเดตรายการที่คลิกเป็นอ่านแล้ว (`isRead = true`)
4. `PATCH /notifications/read-all`: ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว

---

## 6. ตัวอย่างโค้ดต้นแบบสำหรับการนำไปใช้ (Implementation Snippet)

### ฝั่ง Frontend (React + TanStack Query)
```typescript
import { useQuery } from '@tanstack/react-query';

export function useNotificationCount() {
  return useQuery({
    queryKey: ['unread-notifications-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count');
      return res.data.count as number;
    },
    refetchInterval: 12000, // 👈 Polling ทุก 12 วินาที
    refetchOnWindowFocus: true, // 👈 ผู้ใช้สลับแท็บกลับมาหน้าจอ ดึงทันที
    refetchIntervalInBackground: false, // 👈 หยุดยิงเมื่อไม่ได้เปิดดูหน้าเว็บ (ประหยัด Server)
  });
}
```

### ฝั่ง Backend (NestJS Controller)
```typescript
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notiService: NotificationService) {}

  @Get('unread-count')
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notiService.countUnread(userId);
    return { count };
  }
}
```
