# Deploy HAMS บน Ubuntu ของลูกค้า

ชุดนี้แยกจาก `deploy/docker-local` สำหรับติดตั้งใหม่บนเครื่องลูกค้า โดยไม่ย้ายฐานข้อมูล บัญชีทดสอบ กุญแจ หรือ CA ของ VM มาด้วย ตรวจเอกสารเมื่อ 24 ตุลาคม 2026; ยังไม่ได้รันขั้นติดตั้งบนเครื่องลูกค้าจริง

ทำทีละขั้น ถ้าคำสั่งผิดพลาดให้ตรวจขั้นนั้นก่อนเดินต่อ คำสั่งที่ระบุ **PowerShell** รันบน Windows; บล็อก **bash** รันใน SSH ของ Ubuntu ไม่คัดลอกคำสั่ง Windows ลง SSH

**สถานะเอกสาร:** ชุด deploy อยู่ที่ `deploy/production` และใช้ Docker project `hams` แล้ว ต้องกรอก config จริง เตรียม Certificate และผ่านการตรวจแต่ละขั้นก่อนเริ่มบริการบน server

แนวทางสำหรับลูกค้าที่มี VM เดียว: ใช้ผลทดสอบฟีเจอร์จาก Ubuntu VM ของทีมเป็นฐาน แล้วติดตั้ง production บน VM ลูกค้าเพื่อตรวจรับก่อนเปิดใช้งาน โดยเน้น DNS/การส่งต่อพอร์ต/Firewall, Certificate, SMTP และการใช้งานผ่าน URL จริง ยังไม่เริ่มบันทึกข้อมูลใช้งานจริงระหว่างตรวจรับ

ลำดับคือ **ส่วน 3–5 เตรียมเครื่อง/source → ส่วน 6–14 ติดตั้งและตรวจบริการ → ส่วน 15 ตรวจรับและจัดการข้อมูลทดสอบ → ส่วน 16 สำรองข้อมูลตั้งต้นก่อนส่งมอบ** การซ้อม restore ใช้ VM ทดสอบของทีม หรือปลายทางแยกที่ IT อนุมัติ ไม่ restore ทับฐานที่จะส่งมอบ

วิธีอ่านคู่มือนี้: แต่ละขั้นระบุ **ทำเพื่ออะไร**, คำอธิบายคำสั่ง และ **ผลที่ควรได้** ให้ตรวจผลก่อนทำขั้นต่อไป หากเป็นบล็อกที่มี function, loop หรือข้อความระหว่าง `EOF`/`BASH`/`NODE` ให้คัดลอกทั้งบล็อก เพราะบรรทัดเหล่านั้นทำงานร่วมกัน

คำที่ใช้ซ้ำในคำสั่ง:

| คำ/สัญลักษณ์ | ความหมาย |
| --- | --- |
| `sudo` | รันคำสั่งด้วยสิทธิ์ผู้ดูแล Ubuntu; ใช้รหัสผ่านของบัญชี SSH เมื่อระบบถาม |
| `cd` / `Set-Location` | เปลี่ยนโฟลเดอร์ที่กำลังทำงาน บน Ubuntu / PowerShell ตามลำดับ |
| `REPLACE_WITH_...`, `SERVER_IP` | ช่องให้แทนด้วยข้อมูลจริงก่อนรัน ไม่ใช่ค่าที่ใช้งานได้ทันที |
| `\` ท้ายบรรทัด bash | ต่อคำสั่งไปบรรทัดถัดไป ให้คัดลอกทุกบรรทัดของคำสั่งนั้น |
| `>` / `>>` | เขียนผลลงไฟล์ โดย `>` ทับไฟล์เดิม ส่วน `>>` ต่อท้าย; คู่มือนี้สร้าง backup ในโฟลเดอร์ใหม่ |
| `>/dev/null` | ไม่แสดง output ปกติ แต่ error ยังแสดงอยู่ถ้าไม่ได้ redirect แยก |
| `&&` | ทำคำสั่งด้านขวาเมื่อคำสั่งด้านซ้ายสำเร็จเท่านั้น |
| `hams ...` | ชื่อย่อที่เรากำหนดในส่วน 8 เพื่อเรียก Docker Compose ของระบบนี้ ไม่ใช่คำสั่งที่ติดมากับ Ubuntu |

## 1. รูปแบบที่ชุดนี้เตรียมไว้

**ทำเพื่ออะไร:** ให้เข้าใจเส้นทางเว็บ ฐานข้อมูล และ SMTP ก่อนติดตั้ง จะได้กำหนดพอร์ตและ URL ตรงกับระบบเครือข่ายจริง

```text
เครื่องผู้ใช้: https://med.hss05.com:20443
  -> อุปกรณ์ลูกค้าส่งต่อ TCP 20443 ไปยัง IP server:443 โดยคง HTTPS/Host เดิม
  -> Docker frontend/Nginx:8443 รับและถอดรหัส HTTPS
  -> backend:3000 -> postgres:5432 ภายในเครือข่าย Docker
                 -> SMTP ภายนอกผ่านเครือข่าย smtp-egress
```

| รายการ | ค่าของชุดลูกค้า |
| --- | --- |
| Public origin สำหรับเว็บ, Auth และอีเมล | `https://med.hss05.com:20443` |
| พอร์ตที่ Docker เปิดบน server | IPv4 ที่เลือกไว้ พอร์ต `443` |
| Docker project | `hams` |
| PostgreSQL user / database | `hams_prod` / `hams_prod` |
| ข้อมูลถาวร | volumes `hams_postgres-data`, `hams_images`, `hams_image-temp` |
| ไฟล์ตั้งค่าจริง | `/etc/hams` นอก source code |
| Source รุ่นที่ใช้ | `/opt/hams/app` เป็น symlink ไป `/opt/hams/releases/RELEASE` |
| SMTP | `smtp.env` รองรับ Brevo/Gmail ตามบัญชีที่เตรียม |

Nginx อยู่ใน frontend image อยู่แล้ว ไม่ต้องลง Nginx, Node.js, pnpm, npm หรือ PostgreSQL บน host เพื่อใช้ชุดนี้ Build frontend ใช้ npm ส่วน backend/setup ใช้ pnpm ตาม Dockerfile ของโครงการ

ค่า URL อยู่ใน `compose.yaml` และ `nginx.conf` ไม่ได้อ่านจาก `compose.env` หากลูกค้าเปลี่ยนชื่อเว็บหรือพอร์ตภายนอก ต้องปรับทั้งสองไฟล์และทดสอบใหม่

## 2. ข้อมูลที่ต้องยืนยันกับ IT

**ทำเพื่ออะไร:** แยกสิ่งที่ตั้งค่าในแอปออกจาก DNS, การส่งต่อพอร์ต และ Certificate ซึ่งต้องเตรียมร่วมกับผู้ดูแลเครือข่าย

- DNS ของ `med.hss05.com` ต้องชี้ไปยังจุดที่รับบริการนี้ได้จากเครื่องผู้ใช้เป้าหมาย
- ยืนยันเส้นทางภายนอก `20443 -> server:443` รวมการเข้า URL เดียวกันจาก LAN/VPN หากมีการใช้ split DNS หรือ NAT loopback
- ชุดนี้ตั้งสมมติฐานว่า HAMS ถอดรหัส HTTPS เอง หากมี reverse proxy อีกชั้น ต้องยืนยัน TLS/SNI/Host และ IP ของ proxy ก่อนใช้ config นี้ โดยเฉพาะ proxy ที่ตัด `:20443` ออกจาก Host อาจทำให้ redirect วน
- ต้องมี full chain และ private key สำหรับ `med.hss05.com` หรือ wildcard ที่ครอบคลุม พร้อมผู้รับผิดชอบต่ออายุ Certificate
- เครือข่ายต้องอนุญาตการดาวน์โหลดแพ็กเกจ/images ขณะติดตั้ง และให้ backend เชื่อมต่อออกไปยัง SMTP ที่เลือก
- เตรียมเจ้าของบัญชี Admin จริงสองคนและอีเมลที่รับได้ พร้อมปลายทาง backup นอกเครื่องและช่วงเวลาบำรุงรักษา

การไม่มี process รับพอร์ต 443 ยังไม่พิสูจน์ว่า firewall หรือการส่งต่อจากภายนอกพร้อมแล้ว ชุดนี้ไม่เปลี่ยน DNS, NAT, firewall หรือการตั้งค่าบริการอื่นให้อัตโนมัติ

## 3. ตรวจเครื่องก่อนติดตั้ง

**ทำเพื่ออะไร:** ยืนยันว่าเข้าเครื่องถูกตัว มีทรัพยากรและสิทธิ์เพียงพอ เวลาเครื่องถูกต้อง และรู้ว่ามีบริการใดใช้พอร์ตอยู่แล้ว ขั้นนี้ตรวจข้อมูล ยังไม่ติดตั้งโปรแกรม

ตัวอย่างการเข้าเครื่องจาก **PowerShell**; แทน `SERVER_IP` ด้วย IP จริงของลูกค้า:

```powershell
ssh web02@SERVER_IP
```

ตรวจใน **SSH Ubuntu**:

```bash
whoami
hostname
cat /etc/os-release
uname -m
nproc
free -h
df -h / /var/lib
timedatectl status
ip -4 -brief address show scope global
sudo -l
sudo ss -ltnp '( sport = :443 or sport = :20443 or sport = :80 )'
if command -v ufw >/dev/null; then sudo ufw status verbose; fi
```

| คำสั่ง | ทำอะไร / ดูผลตรงไหน |
| --- | --- |
| `ssh web02@SERVER_IP` | เปิด terminal ของ server จาก Windows; หลังเข้าแล้วคำสั่ง Linux จะทำงานบน server |
| `whoami` / `hostname` | แสดงบัญชีที่ล็อกอินและชื่อเครื่อง เพื่อยืนยันว่าไม่ได้สั่งงานอยู่บน Windows หรือ VM ทดสอบ |
| `cat /etc/os-release` | อ่านชื่อและรุ่น OS เพื่อเลือกขั้นตอนติดตั้งให้ตรงรุ่น |
| `uname -m` | แสดงสถาปัตยกรรม CPU เช่น `x86_64` หรือ `aarch64` |
| `nproc` | แสดงจำนวนหน่วยประมวลผลที่ OS ใช้งานได้ |
| `free -h` | ดู RAM/swap โดยเฉพาะ RAM ช่อง `available` ที่ยังใช้งานได้ |
| `df -h / /var/lib` | ดูพื้นที่ว่างของ filesystem ที่เก็บระบบและข้อมูล Docker; ถ้าเป็น filesystem เดียวกันอาจแสดงรายการซ้ำ |
| `timedatectl status` | ตรวจวันเวลาและสถานะ synchronization ซึ่งมีผลกับ TLS และ TOTP |
| `ip -4 -brief address show scope global` | แสดง IPv4 ของ interface เพื่อเลือก `HAMS_BIND_IP`; แยก interface จริงออกจาก Docker bridge |
| `sudo -l` | ตรวจสิทธิ์ sudo ที่บัญชีนี้ได้รับ ไม่ได้เปลี่ยนสิทธิ์ให้บัญชี |
| `sudo ss -ltnp ...` | ดู process ที่กำลังรับ TCP 80/443/20443; มีแต่หัวตารางหมายถึงไม่พบ listener ตามตัวกรองนี้ |
| `if command -v ufw ...` | ถ้ามี UFW ให้ดูสถานะและกฎปัจจุบัน; ถ้าไม่มีจะข้าม ไม่ได้เปิด firewall หรือเพิ่มกฎ |

ขั้นติดตั้งด้านล่างใช้ Ubuntu 22.04/24.04 แบบ 64-bit เป็นฐาน หากเป็น OS/architecture อื่น ให้ตรวจ Docker และซ้อม images บนสถาปัตยกรรมนั้นก่อน ต้องมีพื้นที่สำหรับ build, ฐานข้อมูล, รูป และ backup ไม่ใช่เฉพาะขนาด source

เวลาเครื่องต้อง synchronized; server ใช้ UTC ได้ วันตามธุรกิจไทยจัดการในแอปแล้ว ไม่ต้องเปลี่ยน timezone ของเครื่องเพื่อแก้วันในหน้าเว็บ

ถ้าพบพอร์ต 443 ถูกใช้งาน ให้สำรวจบริการนั้นก่อน ไม่หยุดหรือถอนโปรแกรมเดิมเพื่อให้คำสั่งในคู่มือนี้ผ่าน

**ผลที่ควรได้:** รู้ OS/CPU/RAM/พื้นที่ว่าง/IP จริง มีสิทธิ์ sudo และไม่มีบริการเดิมขัดกับพอร์ตที่ต้องใช้; หากไม่พร้อมให้ตกลงแก้กับ IT ก่อนติดตั้ง

## 4. ติดตั้ง Docker Engine และเครื่องมือเตรียมไฟล์

**ทำเพื่ออะไร:** ให้ Ubuntu รัน containers และ Compose ได้ พร้อมเครื่องมือสำหรับรับ source, สร้างไฟล์ตั้งค่า และตรวจ Certificate ขั้นนี้ติดตั้งแพ็กเกจและเปิด Docker service บน host

สำหรับเครื่องใหม่ที่ยังไม่มี Docker ตามผลตรวจของลูกค้า หากมี Docker/containerd จากชุดอื่นอยู่แล้ว ให้ประเมินการย้ายแพ็กเกจก่อน ใช้ Docker Engine บน Ubuntu ไม่ต้องลง Docker Desktop บน server

ติดตั้งเครื่องมือและ Docker จาก apt repository ทางการ โดยตรวจจาก [คู่มือ Docker Ubuntu](https://docs.docker.com/engine/install/ubuntu/):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git python3 openssl iproute2 nano
sudo install -d -m 0755 /etc/apt/keyrings
sudo curl --fail --show-error --silent --location https://download.docker.com/linux/ubuntu/gpg --output /etc/apt/keyrings/docker.asc
sudo chmod 0644 /etc/apt/keyrings/docker.asc
```

| คำสั่ง | ทำอะไร |
| --- | --- |
| `apt-get update` | ดาวน์โหลดรายการแพ็กเกจล่าสุดจาก repository ที่ตั้งไว้ ยังไม่ได้อัปเกรดโปรแกรมทั้งหมด |
| `apt-get install -y ...` | ติดตั้งเครื่องมือ: `ca-certificates` สำหรับ trust ของ TLS, `curl` ดาวน์โหลด/ตรวจเว็บ, `git` รับ source, `python3` รัน prepare, `openssl` ตรวจ TLS, `iproute2` ตรวจ IP/พอร์ต และ `nano` แก้ไฟล์; `-y` ตอบตกลงการติดตั้ง |
| `install -d -m 0755 /etc/apt/keyrings` | เตรียมโฟลเดอร์เก็บกุญแจตรวจลายเซ็นแพ็กเกจให้ผู้ใช้ทั่วไปอ่าน/เข้าถึงได้ แต่แก้ไขได้เฉพาะเจ้าของ |
| `curl ... --output .../docker.asc` | ดาวน์โหลด public signing key ของ Docker ให้ apt ใช้ตรวจลายเซ็นแพ็กเกจ; ไม่ใช่รหัสผ่านหรือ TLS private key ของเว็บ |
| `chmod 0644 .../docker.asc` | ให้ root เขียนกุญแจได้ และผู้ใช้อื่นอ่านได้เพื่อใช้ตรวจสอบแพ็กเกจ |

```bash
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && printf '%s' "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker info --format 'Docker OS: {{.OSType}}'
sudo docker compose version
python3 --version
```

| คำสั่ง/ส่วนของบล็อก | ทำอะไร |
| --- | --- |
| `tee .../docker.sources <<EOF ... EOF` | เขียนการตั้งค่า apt repository ของ Docker; บรรทัดระหว่าง `EOF` เป็นเนื้อหาไฟล์ ไม่ใช่คำสั่งที่ต้องรันแยก |
| `Suites: $(. /etc/os-release ...)` | อ่าน codename ของ Ubuntu ที่ติดตั้งจริงแล้วใส่ใน repository |
| `Architectures: $(dpkg --print-architecture)` | เลือกแพ็กเกจให้ตรง architecture ของ Ubuntu |
| `Signed-By: .../docker.asc` | กำหนดว่า repository นี้ต้องใช้กุญแจ Docker ที่ดาวน์โหลดมาตรวจลายเซ็น |
| `apt-get update` รอบที่สอง | อ่านรายการแพ็กเกจจาก Docker repository ที่เพิ่งเพิ่ม |
| `apt-get install ... docker-ce ...` | ติดตั้ง Docker Engine, CLI, container runtime, ตัว build images และ Compose plugin |
| `systemctl enable --now docker` | เปิด Docker ตอนนี้ และตั้งให้เริ่มเมื่อ Ubuntu boot; ยังไม่ได้เริ่ม HAMS |
| `docker info ...` | ตรวจว่า CLI ติดต่อ Docker daemon ได้ และ daemon เป็น Linux |
| `docker compose version` / `python3 --version` | ตรวจรุ่น Compose และ Python ตาม prerequisite ของชุด deploy |

ต้องได้ Linux Docker Engine, Compose >= 2.30 และ Python >= 3.10 คู่มือนี้ใช้ `sudo docker` ไม่เพิ่มผู้ใช้เข้า docker group โดยอัตโนมัติ

**ผลที่ควรได้:** คำสั่งติดตั้งจบโดยไม่มี error, `Docker OS: linux` และรุ่น Compose/Python ผ่านเกณฑ์ หาก Docker daemon ไม่ทำงานให้แก้ขั้นนี้ก่อนรับงาน build

ให้ IT จำกัดการเข้าถึงพอร์ตที่ publish ตามเครือข่ายลูกค้า โดยคง SSH ที่ใช้อยู่ Docker มีพฤติกรรม firewall ของพอร์ต publish ต่างจาก process บน host; อย่าอาศัยกฎ UFW อย่างเดียวโดยไม่ทดสอบจากอีกเครื่อง ดู [Docker packet filtering](https://docs.docker.com/engine/network/packet-filtering-firewalls/)

## 5. ส่ง source รุ่นที่ตกลงกัน โดยไม่ต้อง push

**ทำเพื่ออะไร:** ส่งโค้ดที่ commit แล้วจาก Windows ไป Ubuntu แบบระบุ release ชัดเจน โดยไม่ต้องเปิดสิทธิ์เข้าถึง Git remote บน server และเก็บ source แยกแต่ละรุ่นสำหรับการดูแลภายหลัง

ก่อนส่ง ให้รีวิวและ commit ไฟล์ `deploy/production` ครบทั้งชุด รวมงาน runtime ที่ต้องส่งมอบ Git bundle มีเฉพาะข้อมูลที่ commit แล้ว ไม่รวมไฟล์ที่ยังแก้ค้างหรือ `.runtime` ของ VM

Bundle รวมประวัติ Git ที่เข้าถึงได้จาก HEAD ด้วย ไม่ได้จำกัดเฉพาะไฟล์ deploy จึงต้องตรวจว่าไม่มี secrets ที่เคย commit ก่อนส่งให้ปลายทาง และตรวจ SSH host fingerprint ของ server ให้ตรงกับข้อมูลจาก IT คำสั่ง SCP ส่งไฟล์เข้าบัญชี `web02` เท่านั้น ยังไม่ติดตั้งหรือเริ่มระบบ; ถ้าปลายทางมีไฟล์ชื่อเดียวกันอาจถูกเขียนทับ

ตัวอย่างบน **PowerShell เครื่องพัฒนา**; แทน `REPLACE_WITH_SERVER_IP` และใช้บัญชี SSH จริงหากต่างจาก `web02`:

```powershell
& {
  $ErrorActionPreference = 'Stop'
  $hamsServerIp = 'REPLACE_WITH_SERVER_IP'
  if ([string]::IsNullOrWhiteSpace($hamsServerIp) -or $hamsServerIp -eq 'REPLACE_WITH_SERVER_IP') { throw 'Fill the server IP first.' }
  Set-Location 'F:\BUU\HAMS\HAMS_Anntana'
  git status --short
  git ls-files --error-unmatch -- deploy/production/compose.yaml deploy/production/nginx.conf deploy/production/compose.env.example deploy/production/backend.env.example deploy/production/smtp.env.example deploy/production/prepare.sh deploy/production/README.md
  if ($LASTEXITCODE -ne 0) { throw 'Commit the production deployment files before creating a bundle.' }
  $hamsPending = git status --porcelain --untracked-files=normal -- deploy/production Dockerfile.backend Dockerfile.frontend .dockerignore backend/src backend/prisma backend/scripts backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml front-end
  if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect release files.' }
  if ($hamsPending) { throw 'Commit the intended runtime/deployment changes before exporting HEAD.' }
  $hamsRevision = git rev-parse --short=12 HEAD
  if ($LASTEXITCODE -ne 0) { throw 'Cannot read release revision.' }
  $hamsRelease = ($hamsRevision -join '').Trim()
  if ($hamsRelease -notmatch '^[0-9a-fA-F]{12,40}$') { throw 'Invalid release revision.' }
  $hamsBundle = Join-Path $env:TEMP "hams-$hamsRelease.bundle"
  git bundle create $hamsBundle HEAD
  if ($LASTEXITCODE -ne 0) { throw 'Bundle creation failed.' }
  git bundle verify $hamsBundle
  if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
  scp $hamsBundle "web02@${hamsServerIp}:/home/web02/hams-source-${hamsRelease}.bundle"
  if ($LASTEXITCODE -ne 0) { throw 'Source transfer failed.' }
  Write-Host "Release to use on Ubuntu: $hamsRelease"
}
```

| คำสั่ง/ตัวแปรบน PowerShell | ทำอะไร |
| --- | --- |
| `& { ... }` และ `$ErrorActionPreference = 'Stop'` | รันทั้งบล็อกใน scope เดียวและหยุดเมื่อเจอ error/throw; ให้คัดลอกพร้อมวงเล็บเปิดปิดครบ ไม่รันต่อทีละบรรทัดหลังเกิด error |
| `Set-Location ...` | เข้า repository บน Windows ก่อนใช้ Git |
| `git status --short` | แสดงไฟล์ที่แก้หรือยังไม่ถูกติดตาม เพื่อให้ตรวจสิ่งที่จะส่งมอบ |
| `git ls-files --error-unmatch ...` | ตรวจว่าไฟล์ deploy ครบทั้งเจ็ดอยู่ใน Git แล้ว; คำสั่งถัดไปจะหยุดถ้ายังไม่ได้เพิ่ม/commit ให้ครบ |
| `$hamsPending = git status ...` | ตรวจเฉพาะไฟล์ deployment/runtime ที่ระบุว่ามีงานค้างอยู่นอก commit หรือไม่ |
| `if ($LASTEXITCODE -ne 0) { throw ... }` | หยุดบล็อกเมื่อคำสั่งภายนอกก่อนหน้าล้มเหลว แทนที่จะส่งไฟล์ต่อโดยไม่ตรวจผล |
| `if ($hamsPending) { throw ... }` | หยุดถ้ายังมีงาน deployment/runtime ค้าง เพราะ bundle จะไม่รวมการแก้ที่ยังไม่ commit |
| `git rev-parse --short=12 HEAD` | อ่านรหัส commit ของ release ปัจจุบันไว้ใช้ระบุ source และ image tags |
| `Join-Path $env:TEMP ...` | กำหนดชื่อไฟล์ bundle ชั่วคราวบน Windows ไม่ได้สร้าง config หรือคัดลอก secrets |
| `git bundle create ... HEAD` | รวม commit ปัจจุบันและประวัติ Git ที่เกี่ยวข้องลงไฟล์เดียวสำหรับขนย้าย |
| `git bundle verify ...` | ตรวจรูปแบบและความครบของข้อมูล Git ใน bundle ไม่ใช่การรันทดสอบแอป |
| `$hamsServerIp = ...` | กำหนด IP ปลายทางที่ SCP/SSH เข้าถึงได้; ต้องแทน placeholder ก่อน |
| `scp ... web02@...` | ส่ง bundle ผ่าน SSH ไป home ของบัญชี `web02` บน server |
| `Write-Host ...` | แสดงรหัส release ที่ต้องใช้ในขั้น Ubuntu ต่อไป |

สร้าง directory สำหรับ release ใน **SSH Ubuntu**; เปลี่ยน `REPLACE_WITH_RELEASE_COMMIT` เป็นค่าจาก PowerShell:

```bash
(
  set -eu
  HAMS_RELEASE='REPLACE_WITH_RELEASE_COMMIT'
  printf '%s' "$HAMS_RELEASE" | grep -Eq '^[0-9a-fA-F]{12,40}$'
  test -f "$HOME/hams-source-$HAMS_RELEASE.bundle"
  test ! -e /opt/hams/app
  test ! -L /opt/hams/app
  sudo install -d -m 0755 -o "$(id -u)" -g "$(id -g)" /opt/hams /opt/hams/releases
  test ! -e "/opt/hams/releases/$HAMS_RELEASE"
  git clone "$HOME/hams-source-$HAMS_RELEASE.bundle" "/opt/hams/releases/$HAMS_RELEASE"
  git -C "/opt/hams/releases/$HAMS_RELEASE" switch --detach "$HAMS_RELEASE"
  test "$(git -C "/opt/hams/releases/$HAMS_RELEASE" rev-parse HEAD)" = "$(git -C "/opt/hams/releases/$HAMS_RELEASE" rev-parse --verify "${HAMS_RELEASE}^{commit}")"
  ln -s "releases/$HAMS_RELEASE" /opt/hams/app
)
```

ใช้ค่าที่ PowerShell พิมพ์มาโดยตรง บล็อกนี้ตรวจ commit ที่ checkout แล้วและไม่แก้ source ใน release ที่กำลังให้บริการ

| คำสั่งในบล็อก Ubuntu | ทำอะไร |
| --- | --- |
| `( ... )` และ `set -eu` | ทำงานใน shell ย่อย หยุดเมื่อคำสั่งที่บังคับต้องผ่านล้มเหลวหรือใช้ตัวแปรที่ยังไม่กำหนด โดยไม่ทิ้งตัวแปรไว้ใน shell หลัก |
| `HAMS_RELEASE=...` และ `printf ... grep -Eq ...` | กำหนดและตรวจรูปแบบ commit ที่จะติดตั้ง |
| `test -f ...bundle` | ตรวจว่า bundle ที่ส่งมามีอยู่จริง |
| `test ! -e ...` / `test ! -L ...` | หยุดถ้ามี path หรือ symlink ของระบบเดิมอยู่แล้ว เพื่อไม่ทับการติดตั้งที่มีอยู่ |
| `install -d ... -o ... -g ...` | เตรียม `/opt/hams` และ `/opt/hams/releases` ให้บัญชี SSH เป็นเจ้าของ; `id -u`/`id -g` อ่าน UID/GID ของบัญชีนั้น |
| `git clone ...bundle ...releases/...` | สร้าง checkout ของ source จาก bundle ในโฟลเดอร์ release ใหม่ |
| `git ... switch --detach ...` | เลือก commit ที่ระบุโดยตรง ไม่ติดตาม branch ที่อาจเปลี่ยนภายหลัง |
| `test "$(git ... rev-parse HEAD)" = ...` | ตรวจว่า checkout เป็น commit ที่กำหนดจริง |
| `ln -s ... /opt/hams/app` | สร้าง symlink ชื่อคงที่ให้คำสั่ง deploy อ้าง source รุ่นนี้ผ่าน `/opt/hams/app` |

```bash
cd /opt/hams/app
git log -1 --oneline
git status --short
```

`cd` เข้า source ที่จะติดตั้ง, `git log -1 --oneline` แสดง release ล่าสุด และ `git status --short` ตรวจว่า checkout ไม่มีไฟล์แก้ค้าง

**ผลที่ควรได้:** `/opt/hams/app` ชี้ไป release ที่ตกลง รหัส commit ตรงกับ Windows และ checkout สะอาด; ยังไม่มี HAMS containers ถูกเริ่มในขั้นนี้

## 6. เตรียมไฟล์ตั้งค่าครั้งแรก

**ทำเพื่ออะไร:** สร้าง config และกุญแจเฉพาะการติดตั้งจริงบน server แล้วกรอก IP/ผู้ดูแล/SMTP โดยแยก secrets ออกจาก repository

```bash
cd /opt/hams/app
sudo bash deploy/production/prepare.sh --init
```

สคริปต์สร้าง `/etc/hams` mode 0700 และไฟล์ตั้งค่า mode 0600 ซึ่ง root เป็นเจ้าของ:

| ไฟล์ | สิ่งที่ต้องทำ |
| --- | --- |
| `compose.env` | กรอก `HAMS_RELEASE` และ `HAMS_BIND_IP` |
| `backend.env` | กรอกข้อมูลเจ้าของ Admin สองคน; เก็บ DATABASE_URL และกุญแจที่สร้างไว้ |
| `smtp.env` | กรอกบัญชี/รหัส SMTP และผู้ส่งที่ได้รับอนุญาต |
| `postgres-password` | สคริปต์สร้างให้ตรงกับ DATABASE_URL |
| `tls/` | วาง Certificate จริงในขั้นถัดไป |

`--init` จบด้วย `PREPARED_NOT_DEPLOY_READY` ได้ตามปกติ เพราะยังเว้นข้อมูลจริงและ Certificate ไว้ มันไม่ได้เริ่มฐานข้อมูลหรือเว็บ

```bash
git -C /opt/hams/app rev-parse --short=12 HEAD
ip -4 -brief address show scope global
sudo nano /etc/hams/compose.env
sudo nano /etc/hams/backend.env
sudo nano /etc/hams/smtp.env
```

| คำสั่ง | ทำอะไร |
| --- | --- |
| `cd /opt/hams/app` | เข้า source release ที่จะใช้ เพื่อให้ path ของ `prepare.sh` ถูกต้อง |
| `sudo bash .../prepare.sh --init` | เตรียมแม่แบบ config และสุ่มรหัส DB/auth/2FA สำหรับการติดตั้งใหม่; ตรวจและเก็บค่าที่มีอยู่แทนการหมุนกุญแจใหม่ |
| `git ... rev-parse --short=12 HEAD` | อ่าน commit เพื่อกรอก `HAMS_RELEASE` |
| `ip -4 -brief ...` | ดู IPv4 จริงบน server เพื่อกรอก `HAMS_BIND_IP` |
| `sudo nano /etc/hams/compose.env` | แก้ release และ IP ที่ Docker จะ bind พอร์ต 443 |
| `sudo nano /etc/hams/backend.env` | กรอกชื่อ/email/username ของ Admin สองคน โดยคงกุญแจและ DATABASE_URL ที่สคริปต์สร้าง |
| `sudo nano /etc/hams/smtp.env` | กรอก host/port/TLS/login/key/from ของ SMTP ที่เลือก |

ใน nano กด `Ctrl+O` แล้ว `Enter` เพื่อบันทึก จากนั้น `Ctrl+X` เพื่อออก; การบันทึกไฟล์ยังไม่ทำให้ container ที่รันอยู่โหลดค่าใหม่

- `HAMS_RELEASE` ใช้ commit ของ source ที่อยู่ใน `/opt/hams/app` และใช้ค่าเดียวกันตลอดการ build/migrate/start รุ่นนั้น
- `HAMS_BIND_IP` ใช้ IPv4 ของ network interface จริงบน server ที่อุปกรณ์ลูกค้าส่งต่อเข้ามา ไม่ใช้ชื่อ domain, IP container หรือ `0.0.0.0`
- Admin ต้องเป็นคนจริงสองคน อีเมลและ username ต้องต่างกัน รหัสเริ่มต้นและ employee ID สร้างด้วย bootstrap ภายหลัง เจ้าของบัญชีตั้ง Authenticator เอง
- ค่าใน `backend.env`/`smtp.env` ใช้รูปแบบ raw `KEY=value` ไม่ครอบค่าในเครื่องหมายคำพูด ไม่ใช้ `source` โหลดไฟล์เหล่านี้เข้า shell และไม่พิมพ์ secret ออกมาเพื่อส่งในแชต
- `NODE_ENV`, `FRONTEND_URL`, `BETTER_AUTH_URL` และ image paths มาจาก Compose ไม่ต้องเพิ่มซ้ำใน backend.env; prepare.sh ตรวจว่าชื่อ key ตรงกับแม่แบบ

Brevo ตั้งต้นเป็นพอร์ต 587 พร้อม required STARTTLS หากเปลี่ยนเป็น Gmail ให้แก้ชุดค่าใน `smtp.env` และใช้ Google App Password ตามคำอธิบายในแม่แบบ ไม่ใช้รหัสผ่านบัญชี Google ปกติ

**ผลที่ควรได้:** มีไฟล์ตั้งค่าครบ กรอกข้อมูลจริงแล้ว และรหัส DB ในสองตำแหน่งตรงกัน; ยังต้องวาง Certificate และผ่าน `--check` ก่อน build

## 7. ติดตั้ง Certificate จริง

**ทำเพื่ออะไร:** ให้ Nginx แสดง HTTPS สำหรับชื่อเว็บจริง และอ่าน private key ได้ด้วยสิทธิ์ของ container

ขอ `fullchain.pem` และ `privkey.pem` ที่ตรงกันจาก IT ผ่านช่องทางที่อนุมัติ ชื่อใน Certificate ต้องครอบคลุม `med.hss05.com` โดยไม่มีเลขพอร์ต กุญแจต้องเป็น PEM ที่ Nginx อ่านได้โดยไม่ต้องถาม passphrase

หากใช้ SCP รับไฟล์ ให้สร้างโฟลเดอร์รับส่วนตัวใน **SSH** ก่อน:

```bash
install -d -m 0700 "$HOME/hams-tls-incoming"
```

ตัวอย่าง **PowerShell**; แทน `C:\secure` และ `SERVER_IP` ด้วยค่าจริง:

```powershell
scp 'C:\secure\fullchain.pem' 'C:\secure\privkey.pem' web02@SERVER_IP:/home/web02/hams-tls-incoming/
```

จากนั้นใน **SSH**:

```bash
sudo install -o root -g 101 -m 0640 "$HOME/hams-tls-incoming/fullchain.pem" /etc/hams/tls/fullchain.pem
sudo install -o root -g 101 -m 0640 "$HOME/hams-tls-incoming/privkey.pem" /etc/hams/tls/privkey.pem
sudo stat -c '%a %u:%g %n' /etc/hams /etc/hams/tls /etc/hams/tls/fullchain.pem /etc/hams/tls/privkey.pem
```

| คำสั่ง | ทำอะไร |
| --- | --- |
| `install -d -m 0700 ...hams-tls-incoming` | สร้างโฟลเดอร์รับไฟล์ที่บัญชี SSH เข้าถึงได้คนเดียว |
| `scp ...fullchain.pem ...privkey.pem ...` | ส่ง Certificate chain และ private key จาก Windows ไปโฟลเดอร์รับบน server |
| `sudo install -o root -g 101 -m 0640 ...` | คัดลอกแต่ละไฟล์ไปตำแหน่งใช้งาน พร้อมตั้งเจ้าของ root, กลุ่ม 101 ของ Nginx และสิทธิ์อ่านที่จำเป็น; ถ้าไฟล์ปลายทางมีอยู่จะถูกแทนที่ |
| `stat -c '%a %u:%g %n' ...` | แสดง permission, UID:GID และ path เพื่อยืนยันสิทธิ์ โดยไม่แสดงเนื้อหา private key |

TLS directory ต้องเป็น `root:101` mode 0750 เพื่อให้ Nginx ใน container อ่านไฟล์ได้ ไฟล์ที่วางต้องเป็นไฟล์จริง ไม่ใช่ symlink ไปยังพื้นที่อื่น ส่วนสำเนาไฟล์ขาเข้าให้เก็บหรือทำลายตามวิธีจัดการ private key ของ IT

`prepare.sh` ไม่ออก Certificate และไม่ติดตั้ง root CA ให้ หากใช้ CA ภายใน ให้ IT จัดการ trust บน host และเครื่องผู้ใช้อย่างเหมาะสม การตรวจบน host ผ่านไม่รับรองว่า browser ทุกเครื่องไว้ใจ CA แล้ว

ถ้าจะใช้ Let's Encrypt ให้ผู้ดูแลโดเมนเลือกวิธีออกและต่ออายุ: HTTP-01 ต้องเข้าถึงพอร์ต 80, TLS-ALPN-01 ใช้ 443 และ DNS-01 ต้องแก้ DNS การเปิดเว็บที่ 20443 อย่างเดียวไม่พอสำหรับ HTTP-01 ดู [ชนิด challenge](https://letsencrypt.org/docs/challenge-types/)

**ผลที่ควรได้:** มี `fullchain.pem` และ `privkey.pem` ใน `/etc/hams/tls`, ไฟล์เป็น `640 0:101` และ TLS directory เป็น `750 0:101`; ขั้นถัดไปจะตรวจชื่อโดเมน/key/chain/วันหมดอายุอีกครั้ง

## 8. ตรวจค่าก่อน build

**ทำเพื่ออะไร:** ตรวจการตั้งค่าให้ครบก่อนใช้เวลาสร้าง images และเริ่มฐานข้อมูล พร้อมกำหนดคำสั่งย่อสำหรับใช้งาน Compose ชุดเดียวกันตลอดขั้นตอน

```bash
cd /opt/hams/app
sudo bash deploy/production/prepare.sh --check
```

- exit 0 / `CONFIG_CHECKS_PASS`: ค่าตั้งที่ตรวจได้บนเครื่องผ่าน
- exit 2 / `PENDING`: ยังมีช่องที่ต้องกรอกหรือ Certificate ที่ต้องเตรียม
- exit 1 / `PREPARATION_STOPPED`: ข้อมูล/สิทธิ์ผิดหรือ prerequisite ไม่พร้อม ให้ตรวจตามข้อความก่อน

ต้องผ่านก่อนทำต่อ สคริปต์ตรวจรหัส DB คู่กัน, กุญแจ, IP ที่อยู่บนเครื่อง, Admin, TLS ของ SMTP, key/chain/hostname/อายุ Certificate อย่างน้อยเจ็ดวัน และ Compose config แต่ไม่ได้ทดสอบการส่งเมลจริงหรือเส้นทางจากภายนอก

กำหนด function นี้ใน **SSH หน้าต่างที่ใช้ deploy** หากหลุด SSH ให้กำหนดใหม่ก่อนใช้คำสั่ง `hams`:

```bash
hams() {
  sudo env -u HAMS_RELEASE -u HAMS_CONFIG_DIR -u HAMS_BIND_IP \
    -u COMPOSE_FILE -u COMPOSE_PROFILES -u COMPOSE_PROJECT_NAME \
    docker compose \
    --env-file /etc/hams/compose.env \
    -f /opt/hams/app/deploy/production/compose.yaml "$@"
}

hams config --quiet
```

Function ล้างเฉพาะ shell overrides ที่อาจทำให้เลือก project/IP/release ผิด แล้วอ่านไฟล์ `/etc/hams/compose.env` เสมอ ไม่ใส่ `--profile tools` ถาวร เพราะ setup ควรถูกเรียกเป็นครั้ง ๆ

| คำสั่ง/ส่วนของ function | ทำอะไร |
| --- | --- |
| `sudo bash .../prepare.sh --check` | ตรวจ config และ Certificate แบบอ่านอย่างเดียว ไม่สร้างไฟล์หรือเริ่มแอป |
| `hams() { ... }` | สร้างคำสั่งย่อใน SSH session ปัจจุบัน; ต้องคัดลอกทั้ง function และกำหนดใหม่เมื่อเปิด SSH ใหม่ |
| `sudo env -u ...` | ตัดตัวแปร override ที่ระบุออกเฉพาะ process นี้ เพื่อไม่ให้ค่าค้างใน shell เปลี่ยน project/release/IP ที่ต้องการ |
| `docker compose --env-file /etc/hams/compose.env` | โหลดตัวแปรที่ Compose ใช้เลือก release/IP/config directory; ส่วน secrets ของ service โหลดจาก env files ที่ระบุใน compose.yaml |
| `-f /opt/hams/app/deploy/production/compose.yaml` | ระบุ Compose file ให้ชัด แม้ shell จะอยู่โฟลเดอร์อื่น |
| `"$@"` | ส่ง arguments ที่พิมพ์หลัง `hams` ให้ Docker Compose ตามเดิม |
| `hams config --quiet` | ตรวจว่า Compose อ่าน/รวม/แทนค่าตั้งได้ โดยไม่พิมพ์ configuration ที่อาจมี secrets |

**ผลที่ควรได้:** `CONFIG_CHECKS_PASS` และ `hams config --quiet` จบสำเร็จโดยไม่มี error; หากขั้นตรวจไม่ผ่านอย่าเริ่ม build/migrate ต่อ

## 9. Build images ของ release

**ทำเพื่ออะไร:** ดาวน์โหลด PostgreSQL image และสร้างชุดโปรแกรม frontend/backend/setup ที่มี tag ของ release เดียวกัน พร้อมตรวจ Nginx ก่อนเปิดบริการ

```bash
hams pull postgres
hams --profile tools build backend frontend setup
hams --profile tools config --images
hams run --rm --no-deps frontend nginx -t
```

| คำสั่ง | ทำอะไร |
| --- | --- |
| `hams pull postgres` | ดาวน์โหลด PostgreSQL image ตามรุ่นที่ระบุใน Compose ยังไม่เริ่มฐานข้อมูล |
| `hams --profile tools build backend frontend setup` | Build images ทั้งสามจาก source ปัจจุบัน; `--profile tools` เปิดให้เลือก service setup ที่ปกติซ่อนไว้ |
| `hams --profile tools config --images` | แสดงชื่อ/tag images ที่ Compose จะใช้ ไม่ใช่การดึงหรือเริ่ม images |
| `hams run --rm --no-deps frontend nginx -t` | เปิด frontend container ชั่วคราวเพื่อเช็ก syntax/config/TLS files; `--rm` ลบ container ชั่วคราวหลังจบ และ `--no-deps` ไม่เริ่ม services ที่พึ่งพา |

ต้องได้ `nginx: configuration file ... test is successful` คำสั่ง `run` นี้ตรวจ Nginx ใน container ชั่วคราว ไม่ publish พอร์ตของ service และไม่เริ่ม backend เพราะใช้ `--no-deps` ดู [Compose run](https://docs.docker.com/reference/cli/docker/compose/run/)

เก็บ revision และผล build ไว้กับบันทึกการติดตั้ง ไม่มีการใช้ชื่อ image `docker-local` ในชุดลูกค้า

**ผลที่ควรได้:** Build สำเร็จครบสาม images, tag ตรง release และ Nginx configuration test สำเร็จ; ยังไม่ได้เปิดพอร์ตเว็บให้ผู้ใช้เข้าในขั้นนี้

## 10. เริ่มฐานข้อมูล แล้ว migrate/seed reference

**ทำเพื่ออะไร:** สร้างโครงสร้างฐานข้อมูลตาม migration ของ release และใส่ข้อมูลอ้างอิงที่ระบบต้องใช้ เช่น สถานะและประเภทต่าง ๆ ขั้นนี้เขียนข้อมูลลงฐานจริง

สำหรับติดตั้งครั้งแรกบนฐานใหม่เท่านั้น:

```bash
hams up -d --no-build --wait postgres
hams --profile tools run --rm --no-deps setup pnpm exec prisma migrate deploy
hams --profile tools run --rm --no-deps setup pnpm exec prisma migrate status
hams --profile tools run --rm --no-deps setup pnpm run prisma:seed:reference
```

| คำสั่ง | ทำอะไร |
| --- | --- |
| `hams up -d --no-build --wait postgres` | เริ่ม PostgreSQL เบื้องหลังและรอ healthcheck ผ่าน; `--no-build` ไม่ build images ระหว่างเริ่มบริการ |
| `... setup pnpm exec prisma migrate deploy` | เปิด setup container ชั่วคราวเพื่อรัน migrations ที่ยังไม่ถูกใช้กับฐานนี้ เป็นขั้นเปลี่ยนโครงสร้าง DB |
| `... setup pnpm exec prisma migrate status` | อ่านสถานะ migrations เพื่อยืนยันว่าฐานอยู่ในรุ่นที่คาดหมาย |
| `... setup pnpm run prisma:seed:reference` | เพิ่ม/ปรับข้อมูลอ้างอิงตามสคริปต์ของระบบ ไม่ใช่บัญชีหรือรายการครุภัณฑ์ทดลอง |

ต้องผ่านทุกคำสั่ง โดย reference seed แจ้งว่าไม่มี demo records ถูกโหลด ใช้ `migrate deploy` ไม่ใช่ `migrate dev` และไม่รัน demo/presentation seed หรือ reset กับฐานลูกค้า

**ผลที่ควรได้:** PostgreSQL healthy, migrations ไม่มีรายการค้าง และ reference seed สำเร็จ; ยังไม่สร้าง Admin จนกว่าจะตรวจ SMTP และ URL จริงแล้ว

## 11. เริ่มเว็บและตรวจจาก server

**ทำเพื่ออะไร:** เปิด backend/frontend จาก images ที่ build ไว้ แล้วทดสอบ HTTPS และเส้นทาง API ภายใน server ก่อนแยกตรวจเครือข่ายภายนอก

```bash
hams up -d --no-build --pull never --wait backend frontend
hams ps
```

`hams up` สร้างหรือปรับ containers ให้ตรง config, `-d` รันเบื้องหลัง, `--no-build --pull never` ใช้ images ที่เตรียมไว้โดยไม่ build/pull เพิ่ม และ `--wait` รอสถานะพร้อม ส่วน `hams ps` แสดงสถานะกับ port mapping ของ services

ต้องมี postgres/backend/frontend ทำงานและ healthy โดยไม่มี Mailpit ในชุดนี้ `up --wait` ตรวจ container/healthcheck ไม่ใช่หลักฐานว่า SMTP หรือ URL ภายนอกผ่านแล้ว ดู [Compose up](https://docs.docker.com/reference/cli/docker/compose/up/)

ตรวจ HTTPS และ API ที่พอร์ต 443 ของ server โดยยังคง Host ภายนอก 20443:

```bash
HAMS_SERVER_IP="$(sudo sed -n 's/^HAMS_BIND_IP=//p' /etc/hams/compose.env)"
curl --fail --silent --show-error \
  --resolve "med.hss05.com:443:$HAMS_SERVER_IP" \
  --header 'Host: med.hss05.com:20443' \
  --output /dev/null https://med.hss05.com:443/login && echo LOCAL_HTTPS_OK
curl --fail --silent --show-error \
  --resolve "med.hss05.com:443:$HAMS_SERVER_IP" \
  --header 'Host: med.hss05.com:20443' \
  --output /dev/null https://med.hss05.com:443/api/auth/csrf && echo LOCAL_API_OK
```

คำสั่งนี้ตรวจ Certificate โดยไม่ปิด verification และไม่พิมพ์ CSRF token แต่ยังไม่ได้ตรวจ NAT/DNS จากเครื่องผู้ใช้

| ส่วนของคำสั่งตรวจเว็บ | ทำอะไร |
| --- | --- |
| `HAMS_SERVER_IP="$(sudo sed ...)"` | อ่านเฉพาะ `HAMS_BIND_IP` จาก compose.env มาเป็น IP ปลายทาง ไม่ได้โหลด secrets เข้า shell |
| `curl --fail --silent --show-error` | ส่ง HTTP request, คืน error เมื่อ HTTP 400 ขึ้นไป, ซ่อน progress แต่ยังแสดง error |
| `--resolve "med.hss05.com:443:..."` | ให้ request นี้ต่อ IP ของ server โดยตรง แต่ยังใช้ชื่อโดเมนจริงตรวจ Certificate/TLS; ไม่แก้ DNS ถาวร |
| `--header 'Host: med.hss05.com:20443'` | จำลอง Host ที่ Nginx ควรได้รับจากเส้นทางภายนอก แม้กำลังต่อพอร์ตภายใน 443 |
| `--output /dev/null .../login` | ตรวจว่าเส้นทางหน้า Login ตอบกลับได้ โดยไม่พิมพ์ HTML |
| `--output /dev/null .../api/auth/csrf` | ตรวจว่า Nginx ส่งต่อ API ไป backend ได้ โดยไม่พิมพ์ token |
| `&& echo LOCAL_..._OK` | แสดงผลสำเร็จเมื่อ curl จบสำเร็จ; ถ้าไม่เห็นข้อความให้ตรวจ error ก่อน |

**ผลที่ควรได้:** services healthy และเห็นทั้ง `LOCAL_HTTPS_OK` / `LOCAL_API_OK`; ยังต้องเปิด browser จากเครื่องผู้ใช้เพื่อยืนยันเนื้อหาหน้าเว็บและเส้นทางภายนอก

## 12. ตรวจ URL จากเครื่องผู้ใช้จริง

**ทำเพื่ออะไร:** ตรวจเส้นทางที่ผู้ใช้จะเข้าใช้งานจริง ทั้ง DNS, port forwarding/firewall, Certificate และหน้าเว็บ ซึ่งการตรวจจาก server เพียงอย่างเดียวยังยืนยันไม่ได้

รัน **PowerShell ของเครื่องผู้ใช้ที่อยู่ในเครือข่ายเป้าหมาย**:

```powershell
Resolve-DnsName med.hss05.com -Type A
Test-NetConnection med.hss05.com -Port 20443
```

`Resolve-DnsName ... -Type A` ตรวจว่าเครื่องผู้ใช้แปลงชื่อเว็บเป็น IPv4 อะไร ส่วน `Test-NetConnection ... -Port 20443` ตรวจการเชื่อมต่อ TCP ต้องดู `TcpTestSucceeded : True`; ผล TCP ผ่านยังไม่ได้ยืนยัน TLS หรือเนื้อหาหน้าเว็บ

เปิด browser ที่ `https://med.hss05.com:20443/login` ต้องเป็นหน้า HAMS, Certificate ผ่านโดยไม่ต้องข้ามคำเตือน และไม่มี redirect ไป localhost/443/8443 หรือวนกลับหน้าเดิม หากองค์กรใช้ IPv6 ให้ IT ตรวจ AAAA/เส้นทาง IPv6 แยกด้วย; Compose นี้ publish IPv4

ถ้าตรวจที่ server ผ่านแต่ URL ภายนอกไม่ผ่าน ให้ตรวจ DNS/NAT/firewall/การคง Host กับ IT ก่อนแก้โค้ดแอป ไม่เปิด backend:3000 หรือ postgres:5432 ออกสู่ host เพื่อแก้ปัญหานี้

**ผลที่ควรได้:** DNS ตรงกับที่ IT กำหนด, TCP ผ่าน และ browser เปิดหน้า Login ของ HAMS ด้วย Certificate ที่เชื่อถือได้

## 13. ตรวจ SMTP โดยยังไม่ส่งอีเมล

**ทำเพื่ออะไร:** ให้ backend ใน container ทดลองเชื่อมต่อ SMTP ด้วย env ที่ใช้งานจริง ตรวจเครือข่าย/TLS/ชื่อผู้ใช้และรหัสก่อนส่งอีเมล Admin

```bash
hams exec -T backend node <<'NODE'
const nodemailer = require('nodemailer');
const env = process.env;
const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT),
  secure: env.SMTP_SECURE === 'true',
  requireTLS: env.SMTP_REQUIRE_TLS === 'true',
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,
});
(async () => {
  try {
    await transport.verify();
    console.log('SMTP_OK');
  } catch (error) {
    console.error('SMTP_FAILED:', error.code || 'UNKNOWN');
    process.exitCode = 1;
  } finally {
    transport.close();
  }
})();
NODE
```

| ส่วนของบล็อก | ทำอะไร |
| --- | --- |
| `hams exec -T backend node <<'NODE' ... NODE` | ส่ง JavaScript ทั้งบล็อกให้ Node ใน backend container ที่รันอยู่; `-T` ไม่สร้าง interactive terminal และ quote ของ `NODE` ป้องกัน shell แทนค่าข้อความข้างใน |
| `process.env` และ `createTransport(...)` | อ่าน SMTP จาก env ภายใน container แล้วสร้างตัวเชื่อมต่อด้วยค่า host/port/TLS/auth เดียวกับการติดตั้ง |
| ค่า timeout ทั้งสาม | จำกัดเวลารอการเชื่อมต่อ คำทักทาย และ socket เป็น 15 วินาทีต่อ timeout ไม่ใช่การรับประกันว่าบล็อกทั้งหมดจบภายใน 15 วินาที |
| `await transport.verify()` | ตรวจการเชื่อมต่อ SMTP/TLS และ authentication ตามค่าที่ตั้ง โดยยังไม่ส่งข้อความอีเมล |
| `SMTP_OK` / `SMTP_FAILED` | แสดงผลตรวจ; กรณีล้มเหลวแสดงเฉพาะ error code และตั้ง exit code เป็น 1 |
| `transport.close()` | ปิดการเชื่อมต่อหลังตรวจเสร็จ |

`SMTP_OK` ยืนยันการเชื่อมต่อ/TLS/authentication เท่านั้น ยังไม่พิสูจน์ว่าผู้ส่งได้รับอนุญาตหรือผู้รับได้รับอีเมล หากผิดพลาด ตรวจค่ากับผู้ให้บริการและ outbound firewall ไม่เผย key หรือเนื้อหาไฟล์ env

**ผลที่ควรได้:** `SMTP_OK` แล้วจึงไปขั้นส่งจริงและตรวจ inbox/ลิงก์ยืนยัน

## 14. Bootstrap Admin และรับมอบบัญชี

**ทำเพื่ออะไร:** สร้าง/เตรียมบัญชีผู้ดูแลสองคนตาม backend.env และยืนยันว่าเจ้าของรับเมล เปิดใช้บัญชี และตั้ง 2FA ได้จริง ขั้นนี้เขียนข้อมูลผู้ใช้และส่งอีเมลจริง

ทำหลังตรวจอีเมลเจ้าของบัญชีสองคน, SMTP และ URL ภายนอกแล้ว ขั้นนี้ **ส่งอีเมลจริงที่มีรหัสเริ่มต้นและลิงก์ยืนยันไปยังเจ้าของบัญชีที่กำหนด**:

```bash
hams --profile tools run --rm --no-deps setup pnpm run prisma:bootstrap-admins
```

ให้เจ้าของแต่ละคนรับอีเมล กดยืนยัน ตรวจว่า URL เป็น `med.hss05.com:20443` แล้วเข้าสู่ระบบ ตั้ง Authenticator และเก็บ Recovery Codes ด้วยตนเอง จากนั้นตรวจ:

```bash
hams --profile tools run --rm --no-deps setup pnpm run prisma:handover-check
```

ต้องผ่านทั้งสองบัญชี Provider แจ้ง Sent หรือ SMTP_OK อย่างเดียวไม่พอ หาก bootstrap ค้าง ให้แก้สาเหตุและใช้กุญแจเดิม ไม่ลบผู้ใช้หรือสร้าง encryption key ใหม่เพื่อให้รันผ่าน

| คำสั่ง | ทำอะไร |
| --- | --- |
| `... pnpm run prisma:bootstrap-admins` | เรียกสคริปต์เตรียม Admin ที่กำหนดใน config และดำเนินการส่งอีเมลตามสถานะของบัญชี; ไม่ใช่การสร้างบัญชี demo |
| `... pnpm run prisma:handover-check` | ตรวจบัญชี Admin ทั้งสองใน DB รวมสถานะบัญชี การยืนยันอีเมล และการลงทะเบียน 2FA; ไม่ส่ง OTP แทนเจ้าของและไม่ยืนยันแทนการลอง Login จริง |

**ผลที่ควรได้:** เจ้าของทั้งสองยืนยันเมล/ตั้ง 2FA/ลอง Login ได้ และเห็น `Handover check passed: both configured ADMIN accounts are ready.`

## 15. ตรวจรับก่อนเปิดใช้งานจริง

**ทำเพื่ออะไร:** รวบรวมหลักฐานว่าระบบพร้อมสำหรับผู้ใช้จริงหลังย้ายสภาพแวดล้อม การเริ่ม containers ได้เป็นเพียงหนึ่งส่วนของการตรวจรับ

- [ ] เข้าเว็บจากเครื่องเจ้าหน้าที่อีกเครื่องด้วย URL ภายนอกที่กำหนด Certificate และการล็อกอิน/2FA ผ่าน
- [ ] Admin ทั้งสองคนผ่าน handover-check และข้อมูลหน่วยงาน/ผู้ใช้จริงถูกต้อง
- [ ] เมลยืนยันและการส่งซ้ำรับจริง กดลิงก์ได้ โควตาส่งซ้ำและข้อความผิดพลาดทำงาน
- [ ] เส้นทางงานหลักและสิทธิ์ตาม role ผ่าน โดยเน้นจุดต่างจาก VM แทนการรับรองจากการเปิด Login ได้อย่างเดียว
- [ ] อัปโหลด ดู เปลี่ยนรูป JPEG/PNG/WebP/HEIC/HEIF ได้บน Linux และไฟล์เดิมยังอยู่หลัง recreate container
- [ ] หยุด/เปิดหรือ reboot ตามช่วงทดสอบแล้ว DB รูป และการถอดรหัส 2FA ยังใช้ได้
- [ ] ซ้อม backup/restore ลงปลายทางแยกครบตามส่วนถัดไป มีสำเนานอกเครื่องและผู้รับผิดชอบชัดเจน
- [ ] IT ทราบวิธีต่ออายุ Certificate, อ่าน log, start/stop และจัดการอัปเดตตามช่วงเวลาที่ตกลง

ยังไม่ถือว่าพร้อมเปิดจริงจนรายการที่เกี่ยวข้องผ่านบนเครื่องลูกค้า บันทึก release, วันทดสอบ, ผู้ทดสอบ และผลแต่ละรายการ ไม่ใส่ passwords/OTP/recovery codes ในบันทึก

### 15.1 จัดการข้อมูลทดสอบและส่งมอบ

**ทำเพื่ออะไร:** ให้ระบบที่ตรวจผ่านพร้อมรับข้อมูลจริง โดยแยกสิ่งที่สร้างเพื่อทดสอบออกจากข้อมูลตั้งต้นที่ลูกค้าต้องใช้

1. ก่อนทดสอบ จดรายการบัญชี ข้อมูลงาน และรูปจำลองที่จะสร้าง ใช้ชื่อที่แยกได้ชัดและใช้อีเมลของผู้ร่วมทดสอบเท่านั้น
2. เมื่อผลตรวจรับผ่าน ให้ทบทวนรายการที่จะนำออกกับผู้ดูแล แล้วจัดการเฉพาะข้อมูลจำลองและรูปที่เกี่ยวข้องตามลำดับความสัมพันธ์ของระบบ หากหน้าเว็บไม่มีวิธีลบรายการนั้น ต้องเตรียมและรีวิววิธี cleanup เฉพาะรายการก่อนลงมือ ไม่สมมติว่าทุกรายการลบผ่าน CRUD ได้
3. คงข้อมูลอ้างอิง หน่วยงาน/บัญชีจริง และ ADMIN ของลูกค้าที่รับมอบแล้วไว้ พร้อมคง Certificate, SMTP config, DB credentials และกุญแจ Auth/2FA เดิม ไม่ต้องเริ่มยืนยันเมลหรือลงทะเบียน 2FA ใหม่เพียงเพราะจบการทดสอบ
4. ไม่ reset ฐานทั้งหมดเป็นขั้นตอนปกติของการส่งมอบ หากตกลงเริ่มฐานใหม่ ต้องยืนยันว่าไม่มีข้อมูลจริงและวางแผน reference seed/bootstrap/ยืนยันเมล/2FA ใหม่ก่อนทำ
5. ตรวจหน้าเว็บและ ADMIN หลัง cleanup แล้วสำรอง DB + รูป + config/keys + source/images ตามส่วน 16 เก็บหลักฐาน release และผลตรวจรับ ก่อนให้ลูกค้าเริ่มบันทึกข้อมูลจริง

**ผลที่ควรได้:** ไม่มีข้อมูลจำลองปะปนกับข้อมูลส่งมอบ บัญชีจริงยังเข้าใช้ได้ ค่าที่ตรวจผ่านยังคงเดิม และมี backup ตั้งต้นของชุดที่ส่งมอบ

## 16. Backup/restore ที่ต้องมี

**ทำเพื่ออะไร:** เตรียมสำเนาข้อมูลและโปรแกรมที่ตรงรุ่นกันสำหรับกู้ระบบเมื่อเครื่องเสียหรืออัปเดตผิดพลาด และต้องซ้อมกู้บนปลายทางแยกเพื่อยืนยันว่า backup ใช้งานได้จริง

สำรองทั้งชุดที่สอดคล้องกัน ไม่ใช่เฉพาะ DB dump:

| สิ่งที่ต้องเก็บ | ตำแหน่ง/รายละเอียด |
| --- | --- |
| PostgreSQL dump | ฐาน `hams_prod`; ใช้ `pg_dump -Fc` จาก postgres container |
| รูปและไฟล์ชั่วคราว | volumes `hams_images`, `hams_image-temp` พร้อม numeric owner/mode |
| ตั้งค่าและ TLS | `/etc/hams` ทั้ง directory รวม auth/2FA keys, DB/SMTP credentials, Certificate/private key |
| Source และ config deploy | release commit, directory `deploy/production`, symlink ปัจจุบัน |
| Docker images | image IDs ของ container ที่รันจริง และ archive จาก `docker image save`; รวม setup image ของ release |

ทำ backup ในช่วงบำรุงรักษาที่อนุมัติ หยุดรับงานที่ frontend/backend ระหว่างเก็บ dump + files + config เพื่อไม่ให้ DB กับรูปเป็นคนละช่วงเวลา จากนั้นเปิดบริการเดิมและตรวจ healthy/URL อีกครั้ง ต้องกันผู้ดูแลคนอื่นรัน setup หรือเขียน DB/storage ระหว่าง backup ด้วย

ตัวอย่าง backup ครบชุดสำหรับ deployment ที่กำลังทำงานจากโครงสร้างตามคู่มือนี้ รันทั้งบล็อกในช่วงบำรุงรักษาที่ตกลงแล้ว มันจะเก็บ images ก่อน แล้วหยุด frontend/backend ชั่วครู่ระหว่างเก็บข้อมูล ไม่รัน migration หรือ restore:

```bash
sudo bash <<'BASH'
set -euo pipefail
umask 077
backup_id="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="/var/backups/hams/backup-$backup_id"
install -d -m 0700 /var/backups/hams
mkdir -m 0700 "$backup_dir"
hams_backup_compose() {
  env -u HAMS_RELEASE -u HAMS_CONFIG_DIR -u HAMS_BIND_IP \
    -u COMPOSE_FILE -u COMPOSE_PROFILES -u COMPOSE_PROJECT_NAME \
    docker compose --env-file /etc/hams/compose.env \
    -f /opt/hams/app/deploy/production/compose.yaml "$@"
}
test -L /opt/hams/app
source_dir="$(readlink -f /opt/hams/app)"
case "$source_dir" in /opt/hams/releases/*) ;; *) exit 1 ;; esac
for service in backend frontend postgres; do
  container_id="$(hams_backup_compose ps -q "$service")"
  test -n "$container_id"
  test "$(docker inspect --format '{{.State.Running}}' "$container_id")" = true
  image_id="$(docker inspect --format '{{.Image}}' "$container_id")"
  docker image tag "$image_id" "hams-snapshot-$service:$backup_id"
  printf '%s %s\n' "$service" "$image_id"
done > "$backup_dir/image-ids.txt"
setup_image="$(hams_backup_compose --profile tools config --images | grep '^hams-backend-setup:')"
test -n "$setup_image"
docker image tag "$setup_image" "hams-snapshot-setup:$backup_id"
docker image save \
  "hams-snapshot-backend:$backup_id" \
  "hams-snapshot-frontend:$backup_id" \
  "hams-snapshot-postgres:$backup_id" \
  "hams-snapshot-setup:$backup_id" \
  | gzip > "$backup_dir/container-images.tar.gz"
git -c "safe.directory=$source_dir" -C "$source_dir" rev-parse HEAD > "$backup_dir/revision.txt"
readlink /opt/hams/app > "$backup_dir/source-link.txt"
tar --numeric-owner -C "$source_dir" -czf "$backup_dir/source.tar.gz" .
for kind in images image-temp; do
  test "$(docker volume inspect --format '{{ index .Labels "com.docker.compose.project" }}' "hams_$kind")" = hams
done
trap 'hams_backup_compose start backend frontend >/dev/null || printf "%s\n" "Check application startup manually." >&2' EXIT
hams_backup_compose stop --timeout 60 frontend
hams_backup_compose stop --timeout 60 backend
hams_backup_compose exec -T postgres pg_dump -U hams_prod -d hams_prod -Fc \
  > "$backup_dir/database.dump"
test -s "$backup_dir/database.dump"
hams_backup_compose exec -T postgres pg_restore --list \
  < "$backup_dir/database.dump" > "$backup_dir/database-toc.txt"
tar --numeric-owner -C /etc -czf "$backup_dir/config.tar.gz" hams
for kind in images image-temp; do
  docker run --rm --network none --read-only --user 0:0 \
    --security-opt no-new-privileges:true \
    --mount "type=volume,source=hams_$kind,target=/source,readonly" \
    --mount "type=bind,source=$backup_dir,target=/backup" \
    "hams-snapshot-backend:$backup_id" \
    sh -c 'umask 077; tar --numeric-owner -C /source -czf "/backup/$1.tar.gz" .' sh "$kind"
done
(
  cd "$backup_dir"
  gzip -t container-images.tar.gz
  tar -tzf config.tar.gz >/dev/null
  tar -tzf images.tar.gz >/dev/null
  tar -tzf image-temp.tar.gz >/dev/null
  sha256sum database.dump config.tar.gz images.tar.gz image-temp.tar.gz \
    source.tar.gz container-images.tar.gz > SHA256SUMS
  sha256sum -c SHA256SUMS
)
hams_backup_compose start backend frontend
trap - EXIT
printf 'BACKUP_COMPLETE: %s\n' "$backup_dir"
BASH
```

อ่านบล็อก backup เป็นช่วงตามลำดับต่อไปนี้ แล้วรันทั้งบล็อกเมื่อถึงเวลาที่ตกลงไว้:

| คำสั่ง/ช่วงของบล็อก | ทำอะไร / ทำไปเพื่ออะไร |
| --- | --- |
| `sudo bash <<'BASH' ... BASH` | รันสคริปต์ backup ทั้งชุดด้วยสิทธิ์ root; ข้อความระหว่าง delimiter เป็นสคริปต์เดียวกัน |
| `set -euo pipefail` | หยุดเมื่อคำสั่งที่ต้องผ่านล้มเหลว ใช้ตัวแปรที่ไม่ได้กำหนด หรือ pipeline ส่วนใดล้มเหลว เช่น `docker image save` พังก่อนถึง gzip |
| `umask 077` | จำกัดสิทธิ์ตั้งต้นของไฟล์ใหม่ เพราะ backup มีข้อมูลและ secrets |
| `date -u ...`, `backup_dir=...`, `install -d`, `mkdir` | ตั้งชื่อชุด backup ด้วยเวลา UTC แล้วสร้างโฟลเดอร์ใหม่ mode 0700; ถ้าชื่อซ้ำ `mkdir` จะล้มเหลวแทนการเขียนต่อในชุดเดิม |
| `hams_backup_compose() { ... }` | กำหนด Compose wrapper ภายใน root shell นี้โดยตรง ไม่พึ่ง function จาก SSH shell ของผู้ใช้ |
| `test -L`, `readlink -f`, `case ...` | ยืนยันว่า `/opt/hams/app` ชี้ source ใต้ `/opt/hams/releases` ก่อนเก็บรุ่นที่กำลังให้บริการ |
| `for service ...`, `ps -q`, `docker inspect` | อ่าน container IDs และ image IDs ที่รันจริง และหยุดหาก service ที่ต้อง backup ไม่ได้ทำงาน |
| `docker image tag ... hams-snapshot-...` | ตั้ง tag ให้ image เดิมเพื่อระบุชุด backup; ไม่ rebuild หรือเปลี่ยน image ของ container ที่รันอยู่ |
| `printf ... > image-ids.txt` | บันทึกว่าแต่ละ service ใช้ image ID ใดสำหรับตรวจสอบตอนกู้คืน |
| `config --images` กับ `grep '^hams-backend-setup:'` | หา setup image ของ release จาก Compose แล้วตั้ง snapshot tag เพิ่ม เพื่อให้มีเครื่องมือของรุ่นเดียวกันตอนกู้คืน |
| `docker image save ...` และ `gzip` | ส่งออก images ทั้งชุดเป็น archive บีบอัด; ขั้นนี้ยังไม่หยุดแอป |
| `git ... rev-parse HEAD`, `readlink ...`, `tar ...source.tar.gz` | เก็บ commit, symlink target และ source ทั้ง release; `safe.directory` กำหนดเฉพาะคำสั่ง Git นี้เพื่ออ่าน checkout ที่บัญชี SSH เป็นเจ้าของ |
| `docker volume inspect ...` | ตรวจว่า volumes รูปเป็นของ project `hams` ที่คาดหมายก่อนนำไป mount |
| `trap ... EXIT` | เตรียมเรียกเปิด backend/frontend คืนเมื่อจบหรือเกิด error ตามปกติหลังเริ่มช่วงหยุดแอป |
| `stop --timeout 60 frontend` แล้ว `backend` | ปิดช่องรับงานก่อนแล้วหยุดตัวเขียนข้อมูล เพื่อเก็บ DB และรูปในช่วงที่แอปไม่เปลี่ยนข้อมูล |
| `pg_dump ... -Fc > database.dump` | อ่านฐานจริงเป็น PostgreSQL custom-format dump ไม่ใช่การลบหรือ restore ฐาน |
| `test -s ...`, `pg_restore --list` | ตรวจว่า dump ไม่ว่างและอ่านสารบัญได้; ยังไม่ได้ restore หรือพิสูจน์ว่าข้อมูลทุกแถวกู้ได้ |
| `tar --numeric-owner ...config.tar.gz` | เก็บ `/etc/hams` พร้อม owner แบบตัวเลข รวมกุญแจ/SMTP/TLS ที่ต้องใช้คู่กับ DB |
| `docker run --rm ...` และ `tar ...` ใน loop | ใช้ backend image ที่บันทึกไว้เปิด container ชั่วคราว อ่าน volumes รูปแบบ read-only แล้วเขียน archive ไปโฟลเดอร์ backup; ไม่ต่อ network, ใช้ root เพื่อรักษา owner และลบ container หลังจบ |
| `gzip -t`, `tar -tzf` | ตรวจว่า archive ที่ระบุเปิดอ่านได้ โดยไม่แตกทับข้อมูลจริง |
| `sha256sum ... > SHA256SUMS` และ `sha256sum -c ...` | สร้างและตรวจ checksum ของไฟล์หลักสำหรับตรวจความครบหลังคัดลอก; ไม่ได้เข้ารหัสไฟล์หรือแทนการซ้อม restore |
| `start backend frontend`, `trap - EXIT` | เปิด containers เดิมคืน แล้วปลด trap หลังคำสั่ง start สำเร็จ |
| `printf 'BACKUP_COMPLETE: ...'` | แสดงโฟลเดอร์ที่เก็บชุด backup สำเร็จ จากนั้นยังต้องตรวจ health/เว็บจริงและส่งสำเนานอกเครื่อง |

รอ `BACKUP_COMPLETE` แล้วตรวจ `hams ps` และ URL จริงอีกครั้ง trap ช่วยเปิดบริการเดิมคืนเมื่อคำสั่งล้มเหลวตามปกติ แต่ไม่รับรองกรณีไฟดับหรือ process ถูก kill หากไม่มีข้อความสำเร็จ อย่านับ directory ที่สร้างไว้เป็น backup ครบชุด

ส่งสำเนาครบไปปลายทางที่ IT อนุมัติด้วยช่องทางเข้ารหัสและจำกัดสิทธิ์ เพราะ archive มีฐานข้อมูล credentials และ private keys การเก็บบน server เดียวกันไม่ป้องกัน disk หรือเครื่องเสีย ส่วน snapshot image tags/ไฟล์เก่าต้องจัด retention ตามที่ตกลง ไม่ใช้ volume prune แทนการจัดอายุ backup

ซ้อม restore บนเครื่อง/project/volumes แยก โดยใช้ source/images รุ่นเดียวกับ dump คืน DB + images + image-temp + กุญแจเดิมให้ครบ เปลี่ยน database/storage/URL/SMTP ของระบบกู้คืนให้แยกจาก production โดยใช้ hostname แยกเพื่อไม่ให้ cookie/session ชนกัน แล้วตรวจ login, 2FA, จำนวนข้อมูล และรูป พร้อมบันทึกเวลาที่ใช้ คู่มือนี้ไม่มีคำสั่ง restore ทับฐานจริง ต้องกำหนดปลายทางกู้คืนและรีวิวคำสั่งแยกก่อนลงมือ

**ผลที่ควรได้:** มี `BACKUP_COMPLETE`, ระบบเดิมกลับมา healthy/เข้าเว็บได้, checksum ของสำเนานอกเครื่องผ่าน และซ้อม restore ลงปลายทางแยกได้; การสร้างไฟล์ backup สำเร็จเพียงอย่างเดียวยังไม่ถือว่าซ้อมกู้คืนผ่าน

## 17. คำสั่งดูแลตามปกติ

**ทำเพื่ออะไร:** ให้ผู้ดูแลดูสถานะ/ข้อผิดพลาด หยุดเปิดบริการ และเปลี่ยน SMTP หรือ Certificate ได้โดยเข้าใจว่าขั้นใดมีผลต่อ containers ที่รันอยู่

ใน SSH ให้กำหนด function `hams` ตามส่วน 8 ก่อน:

```bash
hams ps
hams logs --tail 100 backend frontend
```

`hams ps` อ่านสถานะ services ส่วน `hams logs --tail 100 backend frontend` อ่าน log ย้อนหลังได้สูงสุด 100 บรรทัดต่อ service ที่เลือก ไม่ได้ restart หรือเปลี่ยนข้อมูล

Log อาจมีข้อมูลผู้ใช้และ error URL จึงตรวจในเครื่องและปิดข้อมูลสำคัญก่อนส่งให้ผู้อื่น Access log ของ Nginx ชุดนี้ตัด query string แต่ไม่ได้รับรองว่า error log ของทุกส่วนปราศจากข้อมูลสำคัญ

หยุด/เปิดเฉพาะแอปตามช่วงบำรุงรักษา โดยคง postgres ทำงาน:

```bash
hams stop --timeout 60 frontend backend
hams up -d --no-build --pull never --wait backend frontend
```

`stop --timeout 60` ให้เวลา process หยุดอย่างเรียบร้อยก่อนบังคับหยุดเมื่อเกินกำหนด โดยคง containers/volumes ไว้ ส่วน `up ... --wait` เปิดแอปตาม config ปัจจุบันและรอพร้อม; ระหว่างหยุดผู้ใช้เข้าเว็บไม่ได้ และ `up` อาจ recreate หาก config เปลี่ยน

หากต้องหยุดทั้งชุดก่อนดูแลเครื่อง:

```bash
hams stop --timeout 60
```

เมื่อไม่ระบุชื่อ service คำสั่ง `stop` จะหยุด services ในชุดที่เลือก รวม PostgreSQL แต่ไม่ลบข้อมูล volumes

เปิดกลับด้วย `up -d --no-build --pull never --wait postgres backend frontend` ไม่ลบ volumes การที่ Docker เริ่มอัตโนมัติหลัง reboot ยังต้องทดสอบร่วมกับ restart policy และการเข้าถึงจริง

### เปลี่ยน SMTP

```bash
sudo nano /etc/hams/smtp.env
sudo bash /opt/hams/app/deploy/production/prepare.sh --check
hams up -d --no-deps --no-build --pull never --force-recreate --wait backend
```

จากนั้นตรวจ SMTP และรับเมลจริงอีกครั้ง การ restart container อย่างเดียวไม่โหลด env ใหม่ และการเปลี่ยน SMTP ไม่ต้อง build/migrate

บล็อกเปลี่ยน SMTP เริ่มจาก `nano` บันทึกค่าชุดใหม่, `prepare.sh --check` ตรวจ config แล้ว `up --force-recreate` สร้าง backend container ใหม่ให้อ่าน env ใหม่; `--no-deps` ไม่ recreate บริการที่พึ่งพา และ `--wait` รอ backend พร้อมก่อนทดสอบส่งจริง มีช่วง backend หยุดสั้น ๆ

### ต่ออายุ Certificate

รับชุดใหม่จากช่องทางของ IT ตรวจชื่อ/key/chain แล้ววางแทนใน `/etc/hams/tls` ด้วย owner/mode ตามส่วน 7 เก็บชุดเดิมใน backup ที่ป้องกันไว้ก่อนเปลี่ยน จากนั้น:

```bash
sudo bash /opt/hams/app/deploy/production/prepare.sh --check
hams exec -T frontend nginx -t
hams exec -T frontend nginx -s reload
```

`prepare.sh --check` ตรวจ key/chain/hostname/อายุและ config, `nginx -t` ตรวจว่า Nginx อ่านค่ากับไฟล์ชุดใหม่ได้ และ `nginx -s reload` สั่ง Nginx โหลด config/Certificate ใหม่; ให้ผ่านสองคำสั่งแรกก่อนรัน reload

ตรวจ Certificate จาก browser/เครื่องผู้ใช้อีกครั้ง รวมวันหมดอายุใหม่ ต้องมีขั้นตอนต่ออายุและผู้รับผิดชอบจริง ไม่ถือว่าติดตั้งครั้งแรกแล้วจะต่ออายุให้อัตโนมัติ

**ผลที่ควรได้:** หลัง start/recreate/reload บริการกลับมา healthy และสิ่งที่เปลี่ยนตรวจผ่านจากการใช้งานจริง เช่น รับเมลได้หรือ browser เห็น Certificate ใหม่

## 18. หลักการอัปเดตและย้อนกลับ

**ทำเพื่ออะไร:** แยกการเตรียม release ออกจากช่วงเปลี่ยนระบบจริง และให้การย้อนกลับคำนึงถึง schema/ข้อมูลด้วย ไม่ใช่เพียงสลับ image tag

1. รับ source ของ release ใหม่ไป directory ใหม่ใต้ `/opt/hams/releases` ตรวจ diff/migrations และเก็บ source รุ่นเดิมไว้ ไม่ `git pull` ทับ release ที่ให้บริการ
2. Build/tag backend/frontend/setup ด้วย commit ใหม่ให้เสร็จก่อนช่วงหยุดระบบ การ build รุ่นใหม่ใช้ Compose ของ release ใหม่และ override `HAMS_RELEASE` เฉพาะคำสั่ง build; ยังไม่แก้ค่าของ live release
3. เก็บ backup ครบชุดของรุ่นเดิมก่อนเปลี่ยน `/etc/hams/compose.env` หรือ schema พร้อมซ้อม restore ที่แยกแล้ว
4. ในช่วงบำรุงรักษา หยุด frontend/backend เปลี่ยน symlink `/opt/hams/app` และ `HAMS_RELEASE` ให้ตรงรุ่นใหม่โดยคง DB/auth/2FA/SMTP keys เดิม
5. ตรวจ `prepare.sh --check` และ Nginx ของรุ่นใหม่ แล้วใช้ setup image รุ่นใหม่รัน `prisma migrate deploy` ก่อนเริ่มแอป ตรวจ migration status และรับงานจากอีกเครื่อง
6. ตรวจสุขภาพ SMTP รูป วันที่/เวลา และงานหลักที่ได้รับผลจาก release นั้น บันทึก revision/ผลก่อนส่งมอบ

การสลับโค้ดหรือ tag กลับไม่ย้อน schema หาก migration ไม่รองรับรุ่นเดิม ต้องใช้แผนกู้ DB/files/config ที่ตรงกันและตกลงเรื่องข้อมูลหลัง backup point ก่อน ห้ามใช้ reset, `down --volumes` หรือ prune volumes เป็นวิธีแก้ปัญหาอัปเดต

คำสั่ง cutover/rollback ต้องรีวิวตาม release และ backup ที่ใช้จริงก่อนรัน คู่มือติดตั้งใหม่ไม่ใช่คำสั่งอนุมัติให้อัปเดต live server อัตโนมัติ

## 19. ขอบเขตหลักฐานของชุดนี้

**ทำเพื่ออะไร:** แสดงว่าตรวจอะไรไปแล้ว และสิ่งใดต้องเก็บผลจาก server จริงเพิ่ม เพื่อไม่ตีความว่าคู่มือหรือ syntax ผ่านเท่ากับติดตั้งจริงผ่าน

- Compose ตรวจโครงสร้างและการแยก project/volumes/SMTP networks แล้ว
- Nginx ตรวจ syntax และ HTTPS/routing/redirect กับ Backend จำลองใน Docker แล้ว ไม่ใช่การตรวจ NAT/Certificate ของลูกค้า
- Env templates ตรวจร่วมกับตัวตรวจค่าของ Backend โดยใช้ข้อมูลจำลอง
- prepare.sh ตรวจ Bash/Python 3.10 และทดสอบ filesystem/OpenSSL บน Linux; ผล metadata/config CLI ของ Docker ถูกจำลองในชุดทดสอบเพื่อไม่แตะ volumes จริง
- การติดตั้ง Docker, build/migrate/bootstrap, SMTP delivery, URL ภายนอก และ backup/restore บนเครื่องลูกค้า ยังต้องรันและเก็บผลจริงตามขั้นที่เกี่ยวข้อง
