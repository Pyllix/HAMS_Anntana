# ทดสอบ HTTP บน VM ส่วนตัว

ใช้เฉพาะชุด `deploy/docker-local` บน VM ของเรา ยังไม่เปลี่ยน `deploy/production` ของลูกค้า

ชุด HTTPS เดิมใช้ `compose.yaml` กับ `nginx.conf` ส่วน HTTP ให้เพิ่ม `compose.http.yaml` เป็นไฟล์สุดท้าย ใช้โปรเจกต์ `hams-deploy-lab` และ volume เดิม จึงเป็นการสลับชุดเดิม ไม่ใช่สร้างฐานข้อมูลทดสอบใหม่

## ก่อนเริ่ม

- ต้องนำโค้ด Backend ที่รองรับ `HAMS_ALLOW_INSECURE_HTTP` และไฟล์ config รอบนี้เข้า VM ก่อน แล้ว build image ใหม่ การคัดลอกเฉพาะ config ไปใช้กับ image เก่าจะยังล็อกอินผ่าน HTTP ไม่ได้
- Docker Compose ต้องเป็นเวอร์ชัน 2.30 ขึ้นไป เช่นเดียวกับชุดเดิม
- ใช้ `.runtime/backend.env`, `postgres-password` และ secret เดิม ไม่ต้องรัน migration, seed หรือ bootstrap ซ้ำสำหรับการเปลี่ยน protocol นี้
- `prepare.ps1` เดิมยังใช้เตรียม secret และ Certificate สำหรับ Mailpit STARTTLS ได้ แม้หน้าเว็บใช้ HTTP การส่ง SMTP ยังคงบังคับ TLS
- ตรวจว่ามี `.runtime/compose.smtp.yaml` ใช้งานอยู่หรือไม่ หากมี ให้ใช้คำสั่งชุด SMTP ด้านล่าง เพื่อรักษาค่า provider และ network เดิม
- คำสั่ง `config --quiet` ตรวจรูปแบบ Compose แต่ไม่ได้ตรวจความถูกต้องของ Nginx หรือการเชื่อมต่อ SMTP

## 1. ใน SSH ของ VM ส่วนตัว

เข้าโฟลเดอร์ source เดิม:

```bash
cd /opt/hams/app
```

### ถ้า VM ใช้ SMTP ภายนอกอยู่แล้ว

คำสั่งชุดนี้ใช้ไฟล์ SMTP เดิมที่เคยตั้งบน VM และวาง HTTP override เป็นตัวสุดท้าย ไม่ต้องเปลี่ยน `smtp.env` เพราะการสลับ protocol หน้าเว็บ

ตรวจการรวม config โดยไม่พิมพ์ secret:

```bash
docker compose --env-file deploy/docker-local/.runtime/smtp.env -f deploy/docker-local/compose.yaml -f deploy/docker-local/.runtime/compose.smtp.yaml -f deploy/docker-local/compose.http.yaml --profile tools config --quiet
```

Build image จากโค้ดปัจจุบัน รวม setup ให้ใช้กฎ HTTP ชุดเดียวกัน:

```bash
docker compose --env-file deploy/docker-local/.runtime/smtp.env -f deploy/docker-local/compose.yaml -f deploy/docker-local/.runtime/compose.smtp.yaml -f deploy/docker-local/compose.http.yaml --profile tools build backend frontend setup
```

ตรวจ Nginx ใน container ชั่วคราว โดยไม่เปิดพอร์ตรับผู้ใช้:

```bash
docker compose --env-file deploy/docker-local/.runtime/smtp.env -f deploy/docker-local/compose.yaml -f deploy/docker-local/.runtime/compose.smtp.yaml -f deploy/docker-local/compose.http.yaml run --rm --no-deps frontend nginx -t
```

เมื่อผ่าน ให้สลับ backend และ frontend ไปใช้ HTTP โดยใช้ข้อมูลเดิม:

```bash
docker compose --env-file deploy/docker-local/.runtime/smtp.env -f deploy/docker-local/compose.yaml -f deploy/docker-local/.runtime/compose.smtp.yaml -f deploy/docker-local/compose.http.yaml up -d --no-build --pull never --wait backend frontend
```

ตรวจสถานะ:

```bash
docker compose --env-file deploy/docker-local/.runtime/smtp.env -f deploy/docker-local/compose.yaml -f deploy/docker-local/.runtime/compose.smtp.yaml -f deploy/docker-local/compose.http.yaml ps
```

### ถ้าใช้ Mailpit ตาม compose.yaml เดิม

ใช้คำสั่งชุดนี้แทนชุด SMTP ภายนอก:

```bash
docker compose -f deploy/docker-local/compose.yaml -f deploy/docker-local/compose.http.yaml --profile tools config --quiet
```

```bash
docker compose -f deploy/docker-local/compose.yaml -f deploy/docker-local/compose.http.yaml --profile tools build backend frontend setup
```

```bash
docker compose -f deploy/docker-local/compose.yaml -f deploy/docker-local/compose.http.yaml run --rm --no-deps frontend nginx -t
```

```bash
docker compose -f deploy/docker-local/compose.yaml -f deploy/docker-local/compose.http.yaml up -d --no-build --pull never --wait backend frontend
```

```bash
docker compose -f deploy/docker-local/compose.yaml -f deploy/docker-local/compose.http.yaml ps
```

## 2. เปิด SSH tunnel จาก PowerShell เครื่อง Windows

ตรวจ IP ปัจจุบันด้วย `hostname -I` ใน VM แล้วแทน `VM_IP` ด้านล่างด้วย IP ของ VM ส่วนตัว ไม่ใช่เซิร์ฟเวอร์ลูกค้า:

```powershell
ssh -N -L 21743:127.0.0.1:21743 hamsadmin@VM_IP
```

เปิดหน้าต่างนี้ค้างไว้ระหว่างทดสอบ จากนั้นเข้า:

```text
http://localhost:21743/login
```

หากใช้ Mailpit และต้องการเปิดกล่องเมลด้วย ให้ใช้ tunnel นี้แทน (พอร์ต 18025 บน Windows ต้องว่าง):

```powershell
ssh -N -L 21743:127.0.0.1:21743 -L 18025:127.0.0.1:18025 hamsadmin@VM_IP
```

Mailpit เปิดที่ `http://localhost:18025` ส่วนลิงก์ยืนยันที่สร้างใหม่ต้องเป็น `http://localhost:21743/api/auth/verify-email?...`

## 3. ตรวจผ่านหน้าเว็บ

- ล้าง cookie ของ `localhost` ก่อนทดสอบ หรือใช้ browser profile ใหม่ เพราะ cookie ไม่แยกตามพอร์ต และ Secure cookie เดิมอาจรบกวนการเปลี่ยนมา HTTP ขั้นตอนนี้จะทำให้ออกจากระบบเว็บ localhost อื่นที่ใช้ cookie ร่วมกันด้วย
- Login ด้วยบัญชีเดิม ต้องเข้า 2FA ตาม role และเข้าใช้งานหลังยืนยันได้
- Refresh หน้าแล้วยังมี session และ logout ได้
- เปิดหน้ารายการและลองบันทึกข้อมูลทดสอบ ตรวจว่าไม่เจอ `CSRF_INVALID`
- ส่งเมลยืนยันใหม่ด้วยบัญชีทดสอบที่ยังไม่ยืนยัน เปิดลิงก์แล้วกลับหน้า login ที่ HTTP พอร์ต 21743
- ตรวจข้อมูลเดิมและรูปที่เคยอัปโหลดว่ายังอยู่
- ไม่ต้องเปลี่ยน TOTP, รหัสผ่าน หรือ auth secret เพื่อทดสอบ HTTP

พอร์ตเว็บใหม่ bind เฉพาะ loopback ของ VM จึงเข้าผ่าน SSH tunnel โดยไม่ต้องเปิด firewall หรือแก้ FortiGate

## กลับไป HTTPS เดิม

ใช้คำสั่ง start ชุดเดิมโดยเอา `-f deploy/docker-local/compose.http.yaml` ออก และคงไฟล์ SMTP override หากใช้อยู่ ตัวอย่าง SMTP ภายนอก:

```bash
docker compose --env-file deploy/docker-local/.runtime/smtp.env -f deploy/docker-local/compose.yaml -f deploy/docker-local/.runtime/compose.smtp.yaml up -d --no-build --pull never --wait backend frontend
```

หากใช้ Mailpit:

```bash
docker compose -f deploy/docker-local/compose.yaml up -d --no-build --pull never --wait backend frontend
```

กลับไปใช้ tunnel และ URL `https://localhost:20443` เดิม และ login ใหม่ ห้ามใช้ `down --volumes` เพราะจะลบข้อมูลของ lab นี้
