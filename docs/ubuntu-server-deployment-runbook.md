# HAMS — ลำดับ deploy บน Ubuntu Server

วันที่ตรวจโค้ด: 21 ตุลาคม 2026 — คู่มือเตรียมติดตั้ง ไม่ใช่หลักฐานว่าทดสอบบน Ubuntu หรือเครื่องลูกค้าแล้ว

แนวทางที่เลือก: Ubuntu + PostgreSQL 17 ในเครื่องเดียวกัน + Node.js + pnpm สำหรับ build + Nginx สำหรับ HTTPS/static frontend + systemd ดูแล backend หนึ่ง process ไม่ต้องใช้ PM2 หรือ Docker ในแนวทางนี้ คำสั่งในเอกสารเป็น Bash บน Ubuntu ไม่ใช่ PowerShell บนเครื่องพัฒนา

ใช้กับ **การติดตั้งใหม่บนฐานข้อมูลว่าง** หากมีระบบหรือฐานข้อมูลเดิม หยุดก่อนขั้นติดตั้ง/ย้ายข้อมูลและจัดทำแผนอัปเกรดแยก ห้ามใช้คู่มือนี้ทับบริการเดิมโดยไม่สำรวจ

วิธีอ่านคำสั่ง: `sudo` ใช้สิทธิ์ผู้ดูแล, `sudo -u hams` รันเป็นบัญชี HAMS, `cd` เปลี่ยนโฟลเดอร์ทำงาน, `$ชื่อ` ใช้ค่าตัวแปร และ `$(คำสั่ง)` นำผลคำสั่งมาแทนในข้อความ ตัวพิมพ์ใหญ่ เช่น `SERVER_IP` และ `REPLACE...` ต้องแทนค่าจริงก่อนรัน บรรทัดเริ่มด้วย `#` เป็นคำอธิบาย

`&&` ทำคำสั่งขวาต่อเมื่อคำสั่งซ้ายสำเร็จ, `|` ส่งผลคำสั่งซ้ายให้คำสั่งขวา, `>` เขียนผลลงไฟล์และทับเนื้อหาเดิม ส่วน `...` ในตารางด้านล่างย่อคำสั่งเต็มด้านบน ไม่ใช่ข้อความที่จะนำไปพิมพ์

คำสั่ง `test` เมื่อผ่านมักไม่พิมพ์อะไร ตรวจทันทีด้วย `echo $?`: `0` คือผ่าน ค่าอื่นคือไม่ผ่าน ให้ตรวจผลทีละช่วง หากออกจาก SSH ตัวแปรอย่าง `RELEASE_DIR` จะหาย ต้องตั้งใหม่ให้ตรง release เดิม

## 0. สิ่งที่ต้องพร้อมก่อนเริ่ม

- บัญชี SSH, IP/hostname, port, วิธีเข้า LAN/VPN และสิทธิ์ sudo
- ชื่อเว็บที่ตกลงกับลูกค้าและ DNS ที่เครื่องเจ้าหน้าที่ resolve ได้, certificate/full chain และ private key หรือสิทธิ์ออก certificate
- SMTP host/port/TLS/ผู้ส่ง/บัญชีถ้ามี และสิทธิ์ให้ server ส่งออกได้
- ADMIN จริงสองคน: ชื่อ นามสกุล username email; employee ID สร้างอัตโนมัติจากโค้ดล่าสุด ไม่ต้องกรอก
- ปลายทาง backup นอกเครื่องและช่วงเวลาหยุดระบบที่ยอมรับได้
- commit ที่จะส่งมอบอยู่ใน remote หรือ release archive แล้ว: การแก้ upload frontend และ bootstrap employee ID ที่ยังอยู่ใน working tree จะไม่ติดไปกับ git clone จนกว่าจะ commit และส่งไปยังแหล่งที่ server ดึงได้

รุ่น Ubuntu, CPU, RAM, disk และบริการที่ติดตั้งอยู่ตรวจเองหลัง SSH ได้ ไม่ต้องให้ลูกค้ากรอกซ้ำ คู่มือนี้สมมติว่าต่ออินเทอร์เน็ตเพื่อดาวน์โหลดแพ็กเกจได้ หากไม่ได้ ต้องเตรียมแพ็กเกจ Ubuntu, Node, pnpm และ dependencies สำหรับ Linux/architecture นั้นจากเครื่อง build ที่ตรงกันก่อน ห้ามย้าย node_modules จาก Windows

## 1. เข้าเครื่องและสำรวจอย่างเดียวก่อน

รันจากเครื่องเรา โดยแทนค่าตัวพิมพ์ใหญ่:

```bash
ssh -p SSH_PORT LOGIN_USER@SERVER_IP
```

เมื่อเข้า Ubuntu แล้ว:

```bash
whoami
hostnamectl
cat /etc/os-release
uname -m
nproc
free -h
df -h
timedatectl status
sudo -l
ip -br address
sudo ss -lntup
sudo systemctl --type=service --state=running
command -v ufw && sudo ufw status verbose
```

บันทึก Ubuntu รุ่น/architecture และดูว่าพอร์ต 80, 443, 3000, 5432 ถูกใช้อยู่หรือไม่ ถ้ามี Nginx/PostgreSQL เดิม ให้ใช้ configuration ที่ IT จัดไว้ ไม่ติดตั้งหรือ restart ทับทันที ตรวจเวลาตรงและ time synchronization ทำงาน เพราะเกี่ยวกับ 2FA และ certificate

หากมี UFW ให้สำรวจ rules ก่อน ไม่สั่ง reset หรือ enable ทันที ต้องคง SSH port จริงและแหล่ง IP/VPN ที่ใช้งานอยู่ เปิด SSH อีก session เพื่อยืนยันการเข้าถึงก่อนปิด session แรกหลังเปลี่ยน firewall

ความหมายของคำสั่งขั้น 1:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `ssh -p SSH_PORT LOGIN_USER@SERVER_IP` | เปิด terminal ของ server ผ่านการเชื่อมต่อเข้ารหัส; `-p` เลือกพอร์ต, ชื่อก่อน `@` คือบัญชีบน server ครั้งแรกตรวจ fingerprint กับ IT เพื่อยืนยันเครื่องปลายทาง |
| `whoami` | แสดงบัญชีที่กำลังใช้งาน ป้องกันสับสนระหว่างบัญชีติดตั้งกับบัญชี service |
| `hostnamectl` | ดูชื่อเครื่องและข้อมูล OS เพื่อยืนยันว่าเข้าเครื่องที่ต้องการ |
| `cat /etc/os-release` | อ่านชื่อและรุ่น Ubuntu ใช้เลือก repository/แพ็กเกจที่รองรับ |
| `uname -m` | ดู architecture เช่น x86_64 หรือ aarch64 เพื่อดาวน์โหลด Node และ native dependencies ให้ถูกชุด |
| `nproc` | ดูจำนวนหน่วยประมวลผลที่ process ใช้ได้ เพื่อประเมินกำลังเครื่อง |
| `free -h` | ดู RAM และ swap โดยแสดงหน่วยอ่านง่าย ใช้ตรวจพื้นที่หน่วยความจำสำหรับ build และแปลงรูป |
| `df -h` | ดูพื้นที่ว่างของแต่ละ filesystem ใช้ประเมินที่เก็บ DB รูป dependencies และ backup |
| `timedatectl status` | ดูเวลา timezone และสถานะซิงก์เวลา ซึ่งมีผลกับ 2FA และอายุ token |
| `sudo -l` | แสดงคำสั่งที่บัญชีนี้ได้รับอนุญาตให้ใช้ sudo เพื่อรู้ว่าติดตั้งและดูแล service ได้หรือไม่ |
| `ip -br address` | ดู IP ของแต่ละ network interface แบบย่อ เพื่อจับคู่กับ DNS และเครือข่ายลูกค้า |
| `sudo ss -lntup` | ดู TCP/UDP sockets ที่กำลังฟัง พร้อม process; `-n` แสดงพอร์ตเป็นตัวเลข ใช้ตรวจพอร์ตชนหรือเปิดเกินจำเป็น |
| `sudo systemctl --type=service --state=running` | ดูบริการที่รันอยู่ เพื่อหลีกเลี่ยงกระทบงานเดิมของลูกค้า |
| `command -v ufw && sudo ufw status verbose` | ตรวจว่ามี UFW แล้วจึงอ่านสถานะ/นโยบาย firewall; ถ้าไม่มีจะไม่รันคำสั่งถัดไป ไม่ได้เปิดหรือแก้กฎ |

ผลที่ต้องได้: รู้รุ่นเครื่อง ทรัพยากร พอร์ต บริการเดิม และสิทธิ์ติดตั้งก่อนเปลี่ยน configuration

## 2. ติดตั้งเครื่องมือพื้นฐาน

สำหรับเครื่องใหม่ที่ตรวจแล้วว่าไม่ชนบริการเดิม:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates xz-utils openssl nginx rsync build-essential python3
```

ไม่สั่ง full OS upgrade/reboot รวมกับขั้นนี้โดยอัตโนมัติ; ทำตามรอบดูแลเครื่องของลูกค้า

ความหมายของคำสั่งขั้น 2:

| คำสั่ง/แพ็กเกจ | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `sudo apt update` | โหลดรายการเวอร์ชันแพ็กเกจล่าสุดจากแหล่งที่ตั้งไว้ ยังไม่ได้อัปเกรดโปรแกรมที่ติดตั้งแล้ว |
| `sudo apt install -y ...` | ติดตั้งแพ็กเกจที่ระบุ; `-y` ตอบยืนยันอัตโนมัติ จึงต้องตรวจรายชื่อก่อนรัน |
| `git` | ดึง source code และเลือก commit ที่จะติดตั้ง |
| `curl` | ดาวน์โหลดไฟล์และทดสอบ HTTP/HTTPS |
| `ca-certificates` | ชุด CA ที่เครื่องใช้ตรวจความน่าเชื่อถือของ HTTPS; CA ภายในองค์กรอาจต้องเพิ่มแยก |
| `xz-utils` | แตกไฟล์ Node ที่บีบอัดเป็น `.tar.xz` |
| `openssl` | สุ่ม secret และตรวจ certificate |
| `nginx` | รับ HTTPS, ส่ง frontend และส่งคำขอ API ไป backend; การติดตั้งอาจเริ่ม service ด้วย |
| `rsync` | คัดลอกไฟล์ frontend build โดยรักษาโครงสร้างไฟล์ |
| `build-essential`, `python3` | เครื่องมือที่ native dependency อาจต้องใช้เมื่อ build บน Linux |

ผลที่ต้องได้: apt ติดตั้งจบโดยไม่มี error; ถ้า repository หรือ download ล้มเหลวให้แก้ก่อนขั้นต่อไป

## 3. ติดตั้ง PostgreSQL 17

เลือก major 17 ให้สอดคล้องกับระบบทดสอบเดิม รับ patch ที่ยังมีการดูแลจาก repository แล้วบันทึกรุ่นจริง โดยต้องทดสอบ patch ที่ส่งมอบด้วย ขั้นตอน PGDG ตาม [PostgreSQL Ubuntu installation](https://www.postgresql.org/download/linux/ubuntu/) ใช้ได้เฉพาะ Ubuntu/architecture ที่ repository รองรับ

```bash
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
sudo apt update
sudo apt install -y postgresql-17 postgresql-client-17
sudo systemctl enable --now postgresql
pg_lsclusters
sudo -u postgres psql -p 5432 -c 'SELECT version();'
sudo -u postgres psql -p 5432 -c 'SHOW listen_addresses;'
```

ต้องได้ cluster 17 ที่พอร์ต 5432 ในตัวอย่างนี้ หากเป็นพอร์ตอื่นหรือมี cluster เดิม ให้ปรับทุกคำสั่งและ DATABASE_URL ให้ตรง ไม่สร้าง cluster ซ้ำ แนะนำรับ connection DB เฉพาะ loopback สำหรับเครื่องเดียวกัน ตรวจ `SHOW hba_file;` และ `SHOW config_file;` หากต้องปรับ; ใช้ password แบบ SCRAM สำหรับ TCP loopback ไม่เปลี่ยนเป็น trust

สร้าง user และฐานใหม่ครั้งเดียว:

```bash
sudo -u postgres createuser -p 5432 --pwprompt --no-superuser --no-createdb --no-createrole hams_app
sudo -u postgres createdb -p 5432 --owner=hams_app hams_prod
psql -h 127.0.0.1 -p 5432 -U hams_app -d hams_prod -W -c 'SELECT current_database(), current_user;'
```

ใส่รหัสผ่านผ่าน prompt เก็บใน password manager อย่าใส่รหัสผ่านจริงในคำสั่งหรือ Git ไม่เปิด 5432 ให้ LAN/อินเทอร์เน็ต และไม่ติดตั้ง Mailpit เป็น SMTP production

ความหมายของคำสั่งขั้น 3:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `apt install -y postgresql-common` | ติดตั้งเครื่องมือจัดการ PostgreSQL บน Ubuntu รวมตัวช่วยตั้ง repository |
| `sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh` | ตั้งแหล่งแพ็กเกจทางการ PostgreSQL ให้เลือกรุ่น 17 ได้ แม้ค่าเริ่มต้น Ubuntu เป็นรุ่นอื่น |
| `sudo apt update` | โหลดรายการจาก repository ที่เพิ่งเพิ่ม |
| `apt install -y postgresql-17 postgresql-client-17` | ติดตั้ง database server และคำสั่ง client เช่น psql/pg_dump สำหรับรุ่น 17 |
| `systemctl enable --now postgresql` | เปิดบริการทันทีและตั้งให้เริ่มเมื่อบูต; ยังต้องตรวจ cluster จริงต่อ |
| `pg_lsclusters` | แสดงรุ่น ชื่อ cluster พอร์ต สถานะ และ data directory เพื่อเลือกฐานให้ถูกตัว |
| `sudo -u postgres psql -p 5432 -c 'SELECT version();'` | ใช้บัญชีผู้ดูแล DB ในเครื่องเรียก SQL หนึ่งคำสั่ง เพื่อยืนยันว่าฐานที่พอร์ตนี้เป็นรุ่นที่ต้องการ |
| `... -c 'SHOW listen_addresses;'` | ดูว่า DB รับ connection ทาง interface ใด สำหรับเครื่องเดียวกันควรจำกัดที่ localhost |
| `SHOW hba_file;`, `SHOW config_file;` | SQL ที่รันผ่าน psql เพื่อหาตำแหน่งไฟล์กฎ authentication และ configuration จริง แทนการเดา path |
| `createuser ... --pwprompt --no-superuser --no-createdb --no-createrole hams_app` | สร้างบัญชี DB ของแอปและถาม password โดยไม่ให้สิทธิ์ superuser/สร้างฐาน/สร้าง role; บัญชีนี้แยกจาก Linux user hams |
| `createdb ... --owner=hams_app hams_prod` | สร้างฐาน production ว่างโดยให้บัญชีแอปเป็นเจ้าของ เพื่อทำ migrations ได้ |
| `psql -h 127.0.0.1 -p 5432 -U hams_app -d hams_prod -W -c ...` | ทดลองเชื่อมต่อแบบ TCP ด้วยบัญชีแอปจริง; `-W` ถาม password; SQL แสดงชื่อ DB และ user ที่เข้าได้ |

ผลที่ต้องได้: cluster online และคำสั่งสุดท้ายคืน `hams_prod`/`hams_app` ถ้าสร้าง user/DB ซ้ำแล้ว error ให้ตรวจของเดิม ไม่ลบทิ้งเพื่อรันใหม่

## 4. ติดตั้ง Node.js และ pnpm รุ่นที่กำหนด

ใช้ Node **24.16.0** และ pnpm **11.5.0** เป็น baseline ตามเครื่องพัฒนา/หลักฐาน Ticket 02 ที่ตรวจพบ ไม่ได้หมายความว่ารับรอง Ubuntu แล้ว ก่อนส่งมอบให้ตรวจ security updates และถ้าปรับรุ่นต้อง build/test รุ่นนั้นซ้ำ ดาวน์โหลด Node จาก [official archive](https://nodejs.org/en/download/archive/v24.16.0)

เลือกติดตั้ง runtime กลางที่ `/opt/hams-node` เพื่อให้ systemd ไม่ต้องอาศัย nvm ของบัญชี SSH (หากเครื่องมี runtime ที่ IT ดูแลอยู่แล้ว สามารถใช้แทนโดยแก้ path และตรวจรุ่นให้ตรง)

```bash
NODE_VERSION=24.16.0
case "$(uname -m)" in
  x86_64) NODE_ARCH=x64 ;;
  aarch64) NODE_ARCH=arm64 ;;
  *) echo 'ต้องเตรียม runtime สำหรับ architecture นี้แยก'; exit 1 ;;
esac
NODE_DIR="node-v${NODE_VERSION}-linux-${NODE_ARCH}"
NODE_SETUP_DIR=$(mktemp -d)
cd "$NODE_SETUP_DIR"
curl -fSLO "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIR}.tar.xz"
curl -fSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
grep " ${NODE_DIR}.tar.xz$" SHASUMS256.txt | sha256sum -c -
# ทำขั้นถัดไปต่อเมื่อ checksum ผ่านเท่านั้น
sudo tar -xJf "${NODE_DIR}.tar.xz" -C /opt
sudo ln -s "/opt/${NODE_DIR}" /opt/hams-node
export PATH="/opt/hams-tools/bin:/opt/hams-node/bin:$PATH"
sudo env PATH="/opt/hams-node/bin:/usr/bin:/bin" /opt/hams-node/bin/npm install --global --prefix /opt/hams-tools pnpm@11.5.0
node --version
npm --version
pnpm --version
```

หาก `/opt/hams-node` มีอยู่แล้ว ให้ตรวจ target ก่อน ไม่ทับ runtime ของระบบอื่น ถ้าออกแล้ว SSH ใหม่ ให้ export PATH บรรทัดเดิมก่อนใช้ pnpm; systemd ในขั้นถัดไปกำหนด PATH เองแล้ว

ความหมายของคำสั่งขั้น 4:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `NODE_VERSION=24.16.0` | ตั้งตัวแปรรุ่นที่จะดาวน์โหลด ยังไม่ได้ติดตั้งอะไร |
| `case "$(uname -m)" in ... esac` | เลือก binary x64/arm64 ให้ตรง CPU; หากไม่รองรับ `echo` จะแสดงเหตุผลและ `exit 1` ออกจาก shell ด้วยสถานะผิดพลาด (ถ้ารันตรงใน SSH อาจปิด session) |
| `NODE_DIR="node-v..."` | ประกอบชื่อไฟล์/โฟลเดอร์ให้ตรงรุ่นและ architecture |
| `NODE_SETUP_DIR=$(mktemp -d)` | สร้างโฟลเดอร์ชั่วคราวชื่อไม่ซ้ำสำหรับดาวน์โหลด ไม่ปนกับไฟล์แอป |
| `cd "$NODE_SETUP_DIR"` | ทำให้ไฟล์ที่ดาวน์โหลดถูกเก็บในโฟลเดอร์เตรียมติดตั้ง |
| `curl -fSLO ...tar.xz` | ดาวน์โหลด Node; `-f` คืน error เมื่อ HTTP ล้มเหลว, `-S` แสดง error, `-L` ตาม redirect, `-O` ใช้ชื่อไฟล์จาก URL |
| `curl -fSLO ...SHASUMS256.txt` | ดาวน์โหลดค่าตรวจสอบไฟล์จากแหล่งทางการ |
| `grep ... SHASUMS256.txt` ส่งต่อให้ `sha256sum -c -` | เลือก checksum ของไฟล์ที่ดาวน์โหลดแล้วตรวจเนื้อหา ต้องขึ้น `OK`; ไม่ใช่การตรวจลายเซ็น GPG แยกต่างหาก |
| `sudo tar -xJf ... -C /opt` | แตก archive ไป `/opt`; `-x` แตกไฟล์, `-J` ใช้ xz, `-f` ระบุไฟล์, `-C` ระบุปลายทาง |
| `sudo ln -s ... /opt/hams-node` | สร้าง symlink หรือชื่ออ้างอิงไป runtime รุ่นนี้ เพื่อให้ service ใช้ path คงที่ |
| `export PATH="...:$PATH"` | ให้ shell นี้ค้นหา Node/pnpm ของ HAMS ก่อนคำสั่งที่ชื่อซ้ำจากที่อื่น |
| `sudo env PATH=... .../npm install --global --prefix /opt/hams-tools pnpm@11.5.0` | ใช้ npm ของ Node ที่เลือกติดตั้ง pnpm รุ่นแน่นอนลงพื้นที่เครื่องมือแยก; `env PATH` กำหนด environment ให้คำสั่งนี้โดยตรง |
| `node --version`, `npm --version`, `pnpm --version` | แสดงรุ่นที่ shell เรียกได้จริง เพื่อตรวจว่าการติดตั้งและ PATH ถูกต้อง |

ผลที่ต้องได้: checksum ผ่าน, Node เป็นรุ่นที่เลือก และ pnpm เป็น 11.5.0 ตาม baseline; บันทึกรุ่น npm ที่มากับ Node ด้วย

## 5. สร้างบัญชี service และแยกพื้นที่ถาวร

```bash
sudo useradd --system --user-group --home-dir /var/lib/hams --create-home --shell /usr/sbin/nologin hams
sudo install -d -o "$(id -un)" -g "$(id -gn)" -m 0755 /opt/hams/releases
sudo install -d -o root -g hams -m 0750 /etc/hams
sudo install -d -o hams -g hams -m 0700 /var/lib/hams/images /var/lib/hams/image-temp
sudo install -d -o root -g root -m 0755 /var/www/hams
sudo install -d -o root -g root -m 0700 /var/backups/hams
```

ตรวจว่าชื่อ user/path ยังไม่มีของเดิมก่อนใช้ โค้ดอยู่ `/opt/hams/releases/<commit>`; รูปและ staging อยู่ `/var/lib/hams`; secrets อยู่ `/etc/hams`; frontend ที่ Nginx อ่านอยู่ `/var/www/hams` ไม่เปิด alias ให้ Nginx อ่านโฟลเดอร์รูปโดยตรง เพราะรูปบุคลากรต้องผ่านสิทธิ์ของ backend

ความหมายของคำสั่งขั้น 5:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `useradd --system --user-group ... --shell /usr/sbin/nologin hams` | สร้าง Linux user/group สำหรับรันแอป พร้อม home directory; ไม่ให้บัญชีนี้ login ด้วย shell ปกติ เพื่อแยกสิทธิ์แอปจากผู้ดูแล |
| `install -d -o ... -g ... -m ... PATH` | สร้างโฟลเดอร์และตั้ง owner/group/permissions ในคำสั่งเดียว; กรณีนี้ไม่ได้ติดตั้งซอฟต์แวร์ |
| `$(id -un)`, `$(id -gn)` | อ่านชื่อ user/group ของผู้ติดตั้ง ใช้ให้บัญชี SSH เป็นเจ้าของพื้นที่เตรียม release |
| `... /opt/hams/releases` | พื้นที่ clone/build แต่ละ commit แยกกัน ทำให้ระบุรุ่นและเตรียมอัปเดตได้ |
| `... /etc/hams` | พื้นที่ config; root แก้ได้ และกลุ่ม hams อ่าน/เข้าถึงได้ตามสิทธิ์ |
| `... /var/lib/hams/images .../image-temp` | พื้นที่รูปและไฟล์ชั่วคราวที่แอปเขียนได้ อยู่ต่อแม้เปลี่ยน release |
| `... /var/www/hams` | พื้นที่ frontend build ที่ Nginx อ่านเพื่อส่งหน้าเว็บ |
| `... /var/backups/hams` | พื้นที่พัก backup ที่เข้าถึงได้เฉพาะ root |

ตัวเลขสิทธิ์: `0755` เจ้าของเขียนได้ คนอื่นอ่าน/เข้าโฟลเดอร์ได้; `0750` ให้เฉพาะเจ้าของกับกลุ่มเข้าถึง; `0700` ให้เฉพาะเจ้าของ ส่วน `0644` ใช้กับไฟล์ที่ทุกคนอ่านได้, `0640` ให้เจ้าของอ่าน/เขียนและกลุ่มอ่าน, `0600` ให้เจ้าของอ่าน/เขียนเท่านั้น สิทธิ์ `x` ของโฟลเดอร์หมายถึงเดินผ่านโฟลเดอร์ได้

## 6. Clone release ที่ระบุและ build

แทน URL และ full commit SHA ด้วย release ที่ตรวจแล้ว ใช้ deploy key แบบ read-only หาก repo เป็น private ไม่ฝัง access token ใน URL:

```bash
REPO_URL='REPLACE_WITH_REPOSITORY_URL'
RELEASE_SHA='REPLACE_WITH_FULL_COMMIT_SHA'
RELEASE_DIR="/opt/hams/releases/$RELEASE_SHA"
git clone "$REPO_URL" "$RELEASE_DIR"
git -C "$RELEASE_DIR" checkout --detach "$RELEASE_SHA"
git -C "$RELEASE_DIR" status --short
git -C "$RELEASE_DIR" rev-parse HEAD
cd "$RELEASE_DIR/backend"
pnpm install --frozen-lockfile
DATABASE_URL='postgresql://unused:unused@127.0.0.1:5432/unused' pnpm exec prisma generate
pnpm run build
test -f dist/src/main.js
node -e "console.log(require('sharp').versions); console.log(require.resolve('libheif-js/wasm-bundle'))"
cd "$RELEASE_DIR/front-end"
pnpm install --frozen-lockfile
pnpm run build
test -f dist/index.html
sudo rsync -a "$RELEASE_DIR/front-end/dist/" /var/www/hams/
sudo chown -R root:root /var/www/hams
sudo find /var/www/hams -type d -exec chmod 0755 {} +
sudo find /var/www/hams -type f -exec chmod 0644 {} +
sudo ln -s "$RELEASE_DIR" /opt/hams/current
```

รันทีละคำสั่งและหยุดเมื่อ error; dummy DATABASE_URL ใช้เฉพาะ generate ที่ไม่เปิด connection ไม่ใช่ค่ารันจริง backend bootstrap/Prisma CLI อยู่ใน devDependencies จึงยังไม่ prune devDependencies ในขั้นติดตั้งนี้ ไม่ใช้ `pnpm update`, ไม่ regenerate lockfile บน server และไม่รัน Vite dev/preview เป็น production

หาก dependency build ถูกบล็อก ตรวจ pnpm build policy ที่ commit มาแล้วและอนุญาตเฉพาะแพ็กเกจที่ตรวจ ไม่เปิดให้ทุก dependency รัน script โดยอัตโนมัติ ผลตรวจ require ของ decoder ยังไม่แทนการ upload HEIC จริง

ความหมายของคำสั่งขั้น 6:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `REPO_URL=...`, `RELEASE_SHA=...`, `RELEASE_DIR=...` | ตั้งแหล่งโค้ด commit และปลายทางติดตั้งให้สัมพันธ์กัน |
| `git clone ...` | ดาวน์โหลด repository ไปพื้นที่ release ยังไม่ได้ติดตั้ง dependencies หรือสร้าง DB |
| `git -C ... checkout --detach ...` | เลือก commit ที่ตรวจรับไว้แน่นอน ไม่เคลื่อนตาม branch โดยอัตโนมัติ; `-C` ให้ Git ทำงานในโฟลเดอร์นั้น |
| `git ... status --short` | ตรวจไฟล์เปลี่ยนแปลงใน checkout ใหม่ ปกติควรว่างก่อน build |
| `git ... rev-parse HEAD` | แสดง commit จริงเพื่อเทียบกับ RELEASE_SHA และบันทึกส่งมอบ |
| `cd .../backend` | เลือก package ของ backend ก่อน install/generate/build |
| `pnpm install --frozen-lockfile` | ติดตั้ง dependencies ตาม lockfile โดยไม่แก้ lockfile; ถ้า package.json ไม่ตรงจะล้มเหลวให้ตรวจ release |
| `DATABASE_URL=... pnpm exec prisma generate` | ใช้ CLI ของโปรเจกต์สร้าง Prisma Client จาก schema; URL dummy มีผลเฉพาะคำสั่งนี้ ไม่ได้สร้างตารางหรือเปลี่ยน DB |
| `pnpm run build` ใน backend | เรียก Nest build เพื่อแปลง TypeScript เป็น JavaScript ใน dist |
| `test -f dist/src/main.js` | ยืนยันว่ามี entrypoint ที่ production launcher ต้องใช้ |
| `node -e "...sharp...libheif..."` | รัน JavaScript สั้น ๆ เพื่อตรวจว่าโหลด sharp และหา HEIF decoder ได้บน Linux; ยังไม่ได้ทดสอบแปลงภาพจริง |
| `cd .../front-end` | เปลี่ยนไป package frontend เพื่อไม่ใช้ scripts ผิดฝั่ง |
| `pnpm install --frozen-lockfile` ใน frontend | ติดตั้ง dependency ของ frontend ตาม lockfile ของฝั่งนี้ |
| `pnpm run build` ใน frontend | สร้าง HTML/CSS/JavaScript สำหรับให้ Nginx ส่งไป browser |
| `test -f dist/index.html` | ตรวจว่าหน้าเริ่มต้นถูก build ออกมาแล้ว |
| `sudo rsync -a .../dist/ /var/www/hams/` | คัดลอกเนื้อหาใน dist ไป web root; `/` ท้าย source หมายถึงคัดลอกเนื้อหาข้างใน; ไม่มี `--delete` จึงไม่ลบไฟล์ปลายทางที่ไม่อยู่ใน source |
| `sudo chown -R root:root /var/www/hams` | ให้ root เป็นเจ้าของไฟล์เว็บทั้งหมด เพื่อไม่ให้ process เว็บแก้ build ได้ |
| `sudo find ... -type d -exec chmod 0755 {} +` | เลือกเฉพาะ directory แล้วตั้งสิทธิ์ให้อ่าน/เดินผ่านได้; `{}` คือ path ที่ find เจอ และ `+` รวมหลาย path ต่อการเรียก |
| `sudo find ... -type f -exec chmod 0644 {} +` | เลือกเฉพาะไฟล์แล้วให้อ่านได้โดยไม่เพิ่มสิทธิ์ execute |
| `sudo ln -s "$RELEASE_DIR" /opt/hams/current` | ชี้ชื่อ current ไป release ที่จะรัน เพื่อให้ service ใช้ path เดิมได้ |

ผลที่ต้องได้: install/build ทั้งสองฝั่งสำเร็จ entrypoints มีจริง และตรวจ decoder ผ่าน หาก `test` หรือ build ไม่ผ่านต้องหยุด ไม่เปิด service ด้วยชุดไฟล์ไม่ครบ

## 7. ตั้ง environment จริงนอก repo

```bash
sudo install -o root -g hams -m 0640 /dev/null /etc/hams/backend.env
sudoedit /etc/hams/backend.env
```

คำสั่ง install ข้างบนใช้ **ครั้งแรกเมื่อไฟล์ยังไม่มี** เท่านั้น เพราะจะทำให้ไฟล์เดิมว่าง ถ้ามีแล้วใช้ sudoedit อย่างเดียว ใส่ค่าต่อไปนี้โดยแทนค่าตัวอย่างทุกจุด:

```dotenv
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://hams_app:URL_ENCODED_PASSWORD@127.0.0.1:5432/hams_prod?schema=public"
BETTER_AUTH_URL="https://hams.example.org"
FRONTEND_URL="https://hams.example.org"
BETTER_AUTH_SECRET="REPLACE_WITH_RANDOM_SECRET"
TWO_FACTOR_ENCRYPTION_KEY="REPLACE_WITH_64_HEX_CHARACTERS"
HAMS_INSTALLATION_MODE=customer
GEMINI_ENABLED=false
IMAGE_STORAGE_PROVIDER=local
IMAGE_STORAGE_ROOT=/var/lib/hams/images
IMAGE_STORAGE_TEMP_ROOT=/var/lib/hams/image-temp
SMTP_HOST="REPLACE_WITH_APPROVED_SMTP_HOST"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER="REPLACE_OR_EMPTY_FOR_APPROVED_IP_RELAY"
SMTP_PASS="REPLACE_OR_EMPTY_FOR_APPROVED_IP_RELAY"
SMTP_FROM="HAMS <REPLACE_WITH_APPROVED_SENDER>"
BOOTSTRAP_ADMIN_1_EMAIL="REPLACE"
BOOTSTRAP_ADMIN_1_USERNAME="REPLACE"
BOOTSTRAP_ADMIN_1_FIRSTNAME="REPLACE"
BOOTSTRAP_ADMIN_1_LASTNAME="REPLACE"
BOOTSTRAP_ADMIN_2_EMAIL="REPLACE"
BOOTSTRAP_ADMIN_2_USERNAME="REPLACE"
BOOTSTRAP_ADMIN_2_FIRSTNAME="REPLACE"
BOOTSTRAP_ADMIN_2_LASTNAME="REPLACE"
```

สร้าง secret สองค่าคนละรอบด้วย `openssl rand -hex 32` ใน terminal ส่วนตัวแล้วนำไปเก็บอย่างปลอดภัย ไม่ส่งค่าเข้า chat/log และไม่สร้างใหม่ทุก deploy ต้องเก็บ encryption key เดิมสำหรับข้อมูล 2FA/credential delivery ที่เข้ารหัสไว้ URL-encode รหัส DB เมื่อประกอบ URL; ไม่ source ไฟล์นี้ด้วย shell เพราะค่า SMTP_FROM/รหัสผ่านอาจมีอักขระพิเศษ

SMTP port 465 ใช้ `SMTP_SECURE=true`; port 587 ใช้ required STARTTLS ตามตัวอย่าง ต้องใช้แบบที่ผู้ให้บริการกำหนด ไม่ปิดการตรวจ certificate เพื่อให้ส่งผ่าน

โค้ดใช้ dotenv จึง link ไฟล์เพื่อให้ทั้ง CLI และ service โหลดแหล่งเดียวกัน:

```bash
sudo ln -s /etc/hams/backend.env "$RELEASE_DIR/backend/.env"
sudo chown -R root:hams "$RELEASE_DIR"
sudo chmod -R go-w "$RELEASE_DIR"
sudo -u hams test -r "$RELEASE_DIR/backend/.env"
sudo -u hams test -w /var/lib/hams/images
sudo -u hams test -w /var/lib/hams/image-temp
```

อย่าใช้ `chown -R -L` เพราะไม่ต้องการตาม symlink ไปเปลี่ยนเจ้าของ secrets ตัวอย่าง `.env.customer.example` ปัจจุบันมี EMPLOYEE_ID เก่า; คู่มือนี้ใช้โค้ด bootstrap ล่าสุดซึ่งสร้างเอง หาก clone รุ่นเก่าจะไม่ได้พฤติกรรมนี้

ความหมายของคำสั่งขั้น 7:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `install -o root -g hams -m 0640 /dev/null /etc/hams/backend.env` | สร้างไฟล์ว่างที่ root แก้และ hams อ่านได้ ใช้ครั้งแรกเท่านั้นเพราะจะทับไฟล์เดิม |
| `sudoedit /etc/hams/backend.env` | เปิด editor เพื่อใส่ configuration จริงแล้วบันทึกด้วยสิทธิ์ที่เหมาะสม ใช้แก้ไฟล์เดิมโดยไม่ล้างเนื้อหาก่อน |
| `openssl rand -hex 32` | สุ่มข้อมูล 32 bytes แสดงเป็นเลขฐานสิบหก 64 ตัว ใช้สร้าง secret/key แยกกันสองค่า |
| `sudo ln -s /etc/hams/backend.env .../backend/.env` | ให้ dotenv ของแอป/CLI อ่านไฟล์ config กลาง โดยไม่เก็บ secret เป็นไฟล์จริงใน repo |
| `sudo chown -R root:hams "$RELEASE_DIR"` | เปลี่ยนเจ้าของ release หลัง build เป็น root และกลุ่ม hams เพื่อให้ service อ่านชุดที่เตรียมไว้ |
| `sudo chmod -R go-w "$RELEASE_DIR"` | เอาสิทธิ์เขียนของ group/คนอื่นออกจาก release ลดโอกาสที่แอปแก้โค้ดตัวเอง |
| `sudo -u hams test -r .../.env` | ตรวจด้วยบัญชี service ว่าอ่าน config ได้จริง |
| `sudo -u hams test -w .../images` | ตรวจว่าบัญชี service เขียนพื้นที่รูปได้ |
| `sudo -u hams test -w .../image-temp` | ตรวจว่าเขียนพื้นที่ staging ได้ ไม่ใช่ผ่านเฉพาะโฟลเดอร์รูปปลายทาง |

ความหมายของค่าตั้ง (เป็นเนื้อหาไฟล์ ไม่ใช่คำสั่ง shell):

| ค่า | ใช้เพื่ออะไร |
| --- | --- |
| `NODE_ENV`, `PORT` | เลือกโหมด production และพอร์ต backend ภายใน |
| `DATABASE_URL` | ระบุบัญชี รหัสผ่าน host port และชื่อ DB ที่แอปใช้ |
| `BETTER_AUTH_URL`, `FRONTEND_URL` | ระบุ URL ภายนอกสำหรับ authentication/ลิงก์อีเมล และ URL หน้าเว็บ ต้องตรง HTTPS ที่ผู้ใช้เข้า |
| `BETTER_AUTH_SECRET` | Secret ของระบบ authentication ต้องใช้ค่า production ที่เป็นส่วนตัว |
| `TWO_FACTOR_ENCRYPTION_KEY` | กุญแจเข้ารหัสข้อมูลที่ระบบต้องถอดกลับ เช่นข้อมูล 2FA; เปลี่ยนโดยไม่มีแผนจะอ่านข้อมูลเดิมไม่ได้ |
| `HAMS_INSTALLATION_MODE`, `GEMINI_ENABLED` | เลือกการติดตั้งลูกค้าและปิดการเรียก Gemini |
| `IMAGE_STORAGE_PROVIDER`, `IMAGE_STORAGE_ROOT`, `IMAGE_STORAGE_TEMP_ROOT` | เลือกเก็บรูปในเครื่องและกำหนดพื้นที่ถาวร/ชั่วคราวนอก release |
| `SMTP_HOST`, `SMTP_PORT` | ที่อยู่และพอร์ตบริการส่งอีเมล |
| `SMTP_SECURE`, `SMTP_REQUIRE_TLS` | เลือก TLS ตั้งแต่เชื่อมต่อ หรือบังคับอัปเกรดเป็น TLS ผ่าน STARTTLS ให้ตรงผู้ให้บริการ |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | บัญชี SMTP และอีเมลผู้ส่งที่ได้รับอนุญาต |
| `BOOTSTRAP_ADMIN_1_*`, `BOOTSTRAP_ADMIN_2_*` | ตัวตนผู้ดูแลจริงสองคนสำหรับสร้างบัญชีและตรวจ handover ไม่มีรหัสผ่านหรือ employee ID ให้กรอก |

## 8. สร้าง schema และข้อมูลอ้างอิง

ใช้ **ฐานว่างที่สร้างในขั้น 3**:

```bash
cd /opt/hams/current/backend
sudo -u hams env PATH="/opt/hams-tools/bin:/opt/hams-node/bin:/usr/bin:/bin" pnpm exec prisma migrate deploy
sudo -u hams env PATH="/opt/hams-tools/bin:/opt/hams-node/bin:/usr/bin:/bin" pnpm exec prisma migrate status
sudo -u hams env PATH="/opt/hams-tools/bin:/opt/hams-node/bin:/usr/bin:/bin" pnpm run prisma:seed:reference
```

คำสั่งนี้อิง Prisma 7 ที่ lock ในโปรเจกต์ หาก migrate ไม่ผ่านให้หยุดตรวจ SQL/ประวัติ ไม่แก้ด้วย reset, db push หรือ migrate resolve แบบเดา ห้ามใช้ `prisma:reset`, `prisma:migrate` (migrate dev) หรือ demo/presentation seed บน production

reference seed เพิ่มข้อมูลกลาง ไม่ได้เพิ่มหน่วยงาน บุคลากร ครุภัณฑ์ และธุรกรรมจริงครบ ต้องเตรียมข้อมูลโรงพยาบาลจริงผ่าน flow ที่รับรองก่อนเปิดให้เจ้าหน้าที่ใช้

ความหมายของคำสั่งขั้น 8:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `cd /opt/hams/current/backend` | ให้ Prisma หา config/schema และ dotenv หา `.env` ของ release ที่กำลังใช้งาน |
| `sudo -u hams env PATH=... ...` | ใช้สิทธิ์เดียวกับ service พร้อมระบุ Node/pnpm ให้แน่นอน ไม่พึ่ง environment ของ sudo หรือ nvm |
| `pnpm exec prisma migrate deploy` | ใช้ CLI ในโปรเจกต์นำ migration ที่ commit ไว้และยังไม่เคยใช้ไปรันกับ DB เพื่อสร้าง/เปลี่ยนตารางจริง |
| `pnpm exec prisma migrate status` | ตรวจสถานะประวัติ migration ว่ายังมีรายการค้างหรือล้มเหลวหรือไม่; ไม่ใช่การทดสอบข้อมูลทุกตาราง |
| `pnpm run prisma:seed:reference` | เรียก script เติม lookup/status/workflow กลางที่แอปต้องใช้ โดยไม่เติมข้อมูล demo |

ผลที่ต้องได้: migrations ไม่มีรายการผิดพลาดหรือค้าง และ seed จบสำเร็จ ตรวจชื่อ DB จาก config ก่อนรัน เพราะคำสั่ง migrate/seed เขียนข้อมูลจริง

## 9. สร้าง systemd service สำหรับ Backend

```bash
sudoedit /etc/systemd/system/hams-backend.service
```

ใส่:

```ini
[Unit]
Description=HAMS Backend
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=hams
Group=hams
WorkingDirectory=/opt/hams/current/backend
Environment=PATH=/opt/hams-node/bin:/usr/bin:/bin
ExecStart=/opt/hams-node/bin/node scripts/start-production.cjs
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/hams
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemd-analyze verify /etc/systemd/system/hams-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now hams-backend
sudo systemctl status hams-backend --no-pager
sudo journalctl -u hams-backend -n 100 --no-pager
curl -i http://127.0.0.1:3000/auth/session
```

ใช้ entrypoint นี้เพราะตั้ง NODE_ENV production ก่อนโหลดแอป; ไม่เดาเป็น `dist/main.js` HTTP session อาจได้ 401 เมื่อไม่มี login ซึ่งต่างจาก connection refused/500 และไม่ใช่ health check ครบทุก dependency

โค้ดปัจจุบัน `app.listen(port)` ไม่ได้ bind เฉพาะ loopback และยังไม่เห็น enableShutdownHooks ใน main.ts จึงต้องกันการเข้าพอร์ต 3000 จากภายนอกด้วย host firewall และทดสอบ stop/restart ระหว่างงานจริง ห้ามถือว่ารับรอง graceful shutdown แล้วเพียง service active

ความหมายของคำสั่งขั้น 9:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `sudoedit .../hams-backend.service` | สร้างไฟล์บอก Ubuntu ว่าจะรันและดูแล backend อย่างไร |
| `systemd-analyze verify ...` | ตรวจรูปแบบ service unit และปัญหาที่ตรวจได้ก่อนเปิดใช้งาน ไม่ได้ตรวจว่าแอปเชื่อม DB สำเร็จ |
| `systemctl daemon-reload` | ให้ systemd อ่านไฟล์ service ใหม่/ที่แก้ โดยยังไม่ restart แอปเอง |
| `systemctl enable --now hams-backend` | ตั้งเปิดหลัง boot และเริ่ม backend ในขณะนี้ |
| `systemctl status hams-backend --no-pager` | ดูสถานะ active/failed และ log ย่อ โดยไม่เปิดโปรแกรมเลื่อนหน้า |
| `journalctl -u hams-backend -n 100 --no-pager` | ดู log ล่าสุด 100 บรรทัดเฉพาะ service นี้ เพื่อหาข้อผิดพลาด config/DB/storage |
| `curl -i http://127.0.0.1:3000/auth/session` | ทดลอง API ตรงจากในเครื่องพร้อมแสดง headers (`-i`) เพื่อแยกปัญหา backend ออกจาก Nginx/TLS |

ความหมายของไฟล์ systemd:

| รายการ | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `[Unit]`, `Description` | ส่วนข้อมูลและชื่อบริการที่แสดงให้ผู้ดูแลอ่าน |
| `After=...` | กำหนดลำดับให้เริ่มหลังหน่วยที่ระบุเมื่อหน่วยเหล่านั้นถูกเรียกเริ่ม; ไม่ใช่การยืนยันว่า DB พร้อมรับ query |
| `Wants=network-online.target` | ขอให้ระบบเตรียมสถานะเครือข่ายระหว่างเริ่ม service |
| `[Service]`, `Type=simple` | กำหนดวิธีรัน process หลักแบบ foreground ไม่ต้องมี PM2 มาครอบ |
| `User`, `Group` | ให้ process ใช้สิทธิ์ hams แทน root |
| `WorkingDirectory` | ตำแหน่งทำงานที่ dotenv และ script ใช้อ้างอิงไฟล์ |
| `Environment=PATH=...` | ระบุ runtime/tools ที่ service มองเห็นอย่างชัดเจน |
| `ExecStart` | คำสั่งจริงที่เริ่ม backend ผ่าน production launcher |
| `Restart=on-failure`, `RestartSec=5` | ล้มเหลวแล้วรอ 5 วินาทีก่อนเริ่มใหม่ ไม่ restart หลังผู้ดูแลสั่ง stop ตามปกติ |
| `TimeoutStopSec=30` | ให้เวลาหยุด process สูงสุดตามค่าที่ตั้งก่อนระบบบังคับหยุด; ต้องทดสอบกับงานที่กำลังทำ |
| `UMask=0077` | จำกัดสิทธิ์เริ่มต้นของไฟล์ใหม่ให้เฉพาะเจ้าของ |
| `NoNewPrivileges=true` | ไม่ให้ process เพิ่มสิทธิ์ผ่านกลไก execute ที่ให้สิทธิ์สูงกว่า |
| `PrivateTmp=true` | แยกพื้นที่ temporary ของ service จาก process ปกติ |
| `ProtectHome=true` | จำกัดการเข้าถึง home ของผู้ใช้ |
| `ProtectSystem=strict`, `ReadWritePaths=/var/lib/hams` | ทำ filesystem ส่วนหลักอ่านอย่างเดียวใน service และเปิดพื้นที่ HAMS ที่จำเป็นให้เขียน |
| `StandardOutput`, `StandardError` | ส่ง log ปกติและ error ไป journal เพื่อดูด้วย journalctl |
| `[Install]`, `WantedBy=multi-user.target` | ระบุให้ enable service เข้ากับโหมดบูตปกติของ server |

ผลที่ต้องได้: service active ต่อเนื่องและ API ตอบ โดยไม่มี config/storage/DB error ใน log การ active อย่างเดียวไม่รับรองทุกฟีเจอร์

## 10. DNS, certificate และ Nginx

ให้ DNS `hams.example.org` ชี้ server ที่เครื่องเจ้าหน้าที่เข้าถึงได้ (ชื่อเป็นตัวอย่างให้เปลี่ยน) LAN-only ใช้ DNS ภายในได้ certificate ต้องตรงชื่อและ browser เชื่อถือ ไม่จำเป็นต้องเปิดเว็บสู่อินเทอร์เน็ตเพื่อใช้ certificate ขององค์กร

แนวทางหลัก: IT ให้ full chain/private key ที่อนุมัติและวิธีต่ออายุ หากจะใช้ public CA ให้เลือก ACME HTTP-01 เมื่อ public DNS/port 80 เข้าถึงจริง หรือ DNS-01 เมื่อจัดการ DNS ได้; ต้องกำหนดวิธีออก/ต่ออายุให้เรียบร้อยก่อนขั้นนี้ ไม่สามารถออก certificate จากชื่อ placeholder ได้

```bash
sudo install -d -o root -g root -m 0700 /etc/hams/tls
# แทน source paths ด้วยไฟล์จริงที่รับผ่านช่องทางปลอดภัย
sudo install -o root -g root -m 0644 /PATH/TO/fullchain.pem /etc/hams/tls/fullchain.pem
sudo install -o root -g root -m 0600 /PATH/TO/privkey.pem /etc/hams/tls/privkey.pem
sudo openssl x509 -in /etc/hams/tls/fullchain.pem -noout -dates -subject -ext subjectAltName
sudoedit /etc/nginx/sites-available/hams
```

ใส่ config โดยเปลี่ยนชื่อเว็บ:

```nginx
server {
    listen 80;
    server_name hams.example.org;
    return 301 https://hams.example.org$request_uri;
}

server {
    listen 443 ssl;
    server_name hams.example.org;
    ssl_certificate /etc/hams/tls/fullchain.pem;
    ssl_certificate_key /etc/hams/tls/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    root /var/www/hams;
    index index.html;
    client_max_body_size 12m;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;

    # Better Auth verification link ใช้ path นี้โดยตรง ต้องคง /api/auth ไว้
    location = /api/auth/verify-email {
        proxy_pass http://127.0.0.1:3000;
    }
    # frontend /api/auth/session -> Nest /auth/session
    # frontend /api/images/... -> Nest /images/...
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
    }
    location = /api { return 308 /api/; }
    location / {
        try_files $uri $uri/ /index.html;
    }
    location ~ /\. { deny all; }
}
```

`proxy_pass` ที่มี `/` ท้ายจะตัด location prefix ต่างจากแบบไม่มี URI ตาม [Nginx proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass) ต้องทดสอบลิงก์ verification จากอีเมลจริงด้วย หากเปลี่ยน Better Auth base path ให้ปรับ mapping ตาม URL ที่สร้างจริง ห้าม proxy `/api/auth/*` ทั้งหมดแบบไม่ตัด prefix เพราะ custom login/session controller อยู่ `/auth/*`

```bash
sudo ln -s /etc/nginx/sites-available/hams /etc/nginx/sites-enabled/hams
sudo nginx -t
# ทำต่อเมื่อ nginx -t ผ่าน และตรวจว่าไม่ชน server_name/config เดิม
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

ไม่ลบ default site หรือ site ลูกค้าอื่นแบบเหมารวม ไม่ใช้ Nginx เสิร์ฟ backend source หรือ `.env` ไม่ใส่ TLS private key ลง Git และจัดให้การต่ออายุ certificate ติดตั้งไฟล์ใหม่ + `nginx -t` + reload พร้อมแจ้งเตือนก่อนหมดอายุ

ความหมายของคำสั่งขั้น 10:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `install -d ... -m 0700 /etc/hams/tls` | เตรียมโฟลเดอร์ TLS ให้ root เข้าถึง เพื่อเก็บ private key |
| `install ... -m 0644 ...fullchain.pem ...` | คัดลอก certificate/full chain ที่ได้รับมาไป path ที่ Nginx ใช้ |
| `install ... -m 0600 ...privkey.pem ...` | คัดลอก private key โดยให้ root อ่าน/เขียนได้คนเดียว |
| `openssl x509 ... -noout -dates -subject -ext subjectAltName` | ดูอายุ certificate และชื่อที่รองรับโดยไม่พิมพ์เนื้อหา certificate ทั้งหมด เพื่อเทียบ domain/วันหมดอายุ |
| `sudoedit /etc/nginx/sites-available/hams` | แก้ configuration เว็บ HAMS ให้ตรงชื่อเว็บและ backend |
| `ln -s ...sites-available/hams ...sites-enabled/hams` | เปิดใช้ site โดยเพิ่มลิงก์ในตำแหน่งที่ Nginx โหลด |
| `sudo nginx -t` | ตรวจ syntax และการเปิดไฟล์ที่อ้างอิง เช่น certificate ก่อนนำ config ไปใช้ |
| `systemctl enable --now nginx` | ตั้งให้เปิดหลังบูตและเริ่ม Nginx ตอนนี้ |
| `systemctl reload nginx` | ให้ Nginx โหลด config ใหม่โดยไม่หยุด service ทั้งตัว |

ความหมายของ configuration Nginx:

| รายการ | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `server { ... }`, `server_name` | กำหนดเว็บและชื่อโดเมนที่ block นี้รับผิดชอบ |
| `listen 80`, `return 301 https://...$request_uri` | รับ HTTP แล้วส่งผู้ใช้ไป HTTPS โดยรักษา path/query เดิม |
| `listen 443 ssl` | เปิดรับ HTTPS ที่พอร์ตมาตรฐาน |
| `ssl_certificate`, `ssl_certificate_key` | ชี้ไฟล์ full chain และ private key สำหรับ TLS |
| `ssl_protocols TLSv1.2 TLSv1.3` | เลือกรุ่น TLS ที่รองรับใน config นี้ |
| `root`, `index` | ระบุ frontend build และไฟล์หน้าเริ่มต้น |
| `client_max_body_size 12m` | จำกัดขนาด request และเผื่อ multipart overhead ให้รูปตาม limit แอป; แอปยังตรวจ limit รูปเอง |
| `proxy_http_version 1.1` | ใช้ HTTP/1.1 คุยกับ backend เหมาะกับ connection ที่เปิดค้าง |
| `proxy_set_header Host ...`, `X-Forwarded-Host ...` | ส่งชื่อ host ที่ผู้ใช้เข้าให้ backend |
| `X-Forwarded-Proto $scheme` | บอก backend ว่าการเชื่อมต่อฝั่งผู้ใช้เป็น HTTPS |
| `X-Forwarded-For $remote_addr` | ส่ง IP ที่ Nginx เห็น แทนการเชื่อ header ที่ client ส่งเอง; ถ้ามี load balancer ด้านหน้าต้องออกแบบ trusted proxy เพิ่ม |
| `proxy_set_header Connection ""` | ไม่ส่ง Connection header แบบเดิมต่อไป เพื่อรองรับการเชื่อมต่อ upstream |
| `proxy_buffering off`, `proxy_cache off` | ส่ง event ถึง browser โดยไม่รอสะสม/ใช้ cache สำคัญกับ SSE และ API ผู้ใช้ |
| `proxy_read_timeout 3600s` | ระยะรอการอ่านข้อมูลครั้งถัดไปจาก backend ไม่ใช่อายุสูงสุดของ session ผู้ใช้ |
| `location = /api/auth/verify-email` | จับเฉพาะ endpoint verification เพื่อรักษา path ของ Better Auth |
| `proxy_pass http://127.0.0.1:3000;` | ส่ง URI เดิมไป backend โดยไม่มีการแทน prefix ด้วย `/` |
| `location /api/` กับ `proxy_pass ...:3000/;` | ตัด `/api/` ชั้น frontend ก่อนส่งไป controller backend |
| `location = /api { return 308 /api/; }` | เติม slash ให้ path `/api` ด้วย redirect ที่รักษา HTTP method |
| `try_files $uri $uri/ /index.html` | ถ้ามีไฟล์จริงให้ส่งไฟล์ ไม่เช่นนั้นส่ง React index เพื่อให้ refresh/deep link ทำงาน |
| `location ~ /\.` กับ `deny all` | ปฏิเสธ URL ที่เข้าถึงไฟล์/โฟลเดอร์ขึ้นต้นด้วยจุด เช่น `.env`; config นี้ไม่ได้เตรียม HTTP-01 challenge directory |

ผลที่ต้องได้: `nginx -t` ผ่านก่อน reload และ certificate ตรงชื่อเว็บ/ยังไม่หมดอายุ จากนั้นทดสอบผ่าน browser ที่เชื่อถือ CA จริง

## 11. จำกัดเครือข่ายแล้วตรวจจากเครื่องผู้ใช้

เมื่อ IT ยืนยันใช้ UFW เป็น host firewall และตรวจ rules เดิมแล้ว ตัวอย่างสำหรับ server ใหม่ ใช้ IP/CIDR/port จริง:

```bash
sudo ufw allow from ADMIN_VPN_CIDR to any port SSH_PORT proto tcp
sudo ufw allow from STAFF_LAN_CIDR to any port 443 proto tcp
sudo ufw allow from STAFF_LAN_CIDR to any port 80 proto tcp
sudo ufw deny 3000/tcp
sudo ufw deny 5432/tcp
sudo ufw status numbered
```

หากยัง inactive ให้เปิด `sudo ufw enable` **หลัง** rule SSH ถูกต้องและตรวจบริการอื่นครบแล้วเท่านั้น หากมี allow ที่กว้างกว่ากฎ deny อยู่ก่อน ต้องปรับตามลำดับจริง ไม่ถือว่าบรรทัด deny ท้ายสุดป้องกันได้เสมอ ถ้าใช้ IPv6 ต้องตั้ง DNS/listener/firewall ให้สอดคล้องด้วย หากเครื่องใช้ firewall อื่น ให้ทำ policy เทียบเท่าที่ระบบนั้น ไม่เพิ่ม UFW ซ้อนโดยไม่จำเป็น

จากเครื่องเจ้าหน้าที่:

```bash
curl -I https://hams.example.org/
curl -i https://hams.example.org/api/auth/session
```

ไม่ใช้ `curl -k` เป็นหลักฐานผ่าน ต้องไม่มี certificate warning และเข้าพอร์ต backend/DB โดยตรงจากเครื่องอื่นไม่ได้ หากเป็น CA ภายในให้ IT ติดตั้ง root CA บนเครื่องผู้ใช้

ความหมายของคำสั่งขั้น 11:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `ufw allow from ADMIN_VPN_CIDR to any port SSH_PORT proto tcp` | อนุญาตเข้าดูแลผ่าน SSH จากเครือข่ายที่กำหนด; CIDR เช่น `10.20.0.0/24` เป็นเพียงรูปแบบตัวอย่าง ต้องใช้ค่าจริง |
| `ufw allow from STAFF_LAN_CIDR ... port 443 ...` | ให้เครื่องเจ้าหน้าที่เข้า HTTPS ได้ตามขอบเขตเครือข่าย |
| `ufw allow from STAFF_LAN_CIDR ... port 80 ...` | ให้เข้า HTTP เพื่อ redirect ไป HTTPS |
| `ufw deny 3000/tcp` | ปิดการเข้า backend โดยตรงจากเครือข่าย เพื่อให้ผ่าน Nginx |
| `ufw deny 5432/tcp` | ปิดการเข้าฐานข้อมูลจากเครือข่าย; แอปในเครื่องเชื่อมผ่าน loopback ตามกฎจริง |
| `ufw status numbered` | ดูกฎพร้อมเลขลำดับ ใช้ตรวจว่ากฎเก่าที่กว้างกว่ามีผลก่อนหรือไม่ |
| `sudo ufw enable` | เปิดใช้งาน firewall จริง จึงต้องตรวจการอนุญาต SSH และบริการอื่นก่อน |
| `curl -I https://.../` | ส่ง HEAD เพื่อดู HTTP status/headers และตรวจ TLS โดยไม่ดาวน์โหลด body |
| `curl -i https://.../api/auth/session` | ทดสอบ API ผ่าน DNS/TLS/Nginx ครบเส้นทาง; `-i` แสดงทั้ง headers และ body |

ผลที่ต้องได้: เครื่องเจ้าหน้าที่เข้าเว็บได้, SSH ใหม่ยังเข้าได้, พอร์ต 3000/5432 เข้าโดยตรงจากเครื่องอื่นไม่ได้ และไม่ได้ทำบริการอื่นที่ได้รับอนุญาตเสีย

## 12. Bootstrap ADMIN และส่งมอบบัญชี

ขั้นนี้ส่งอีเมลจริงไปยังสองเจ้าของบัญชีที่ตั้งไว้ จึงรันหลัง HTTPS/SMTP พร้อมและเป็นช่วงส่งมอบที่ตกลงกัน:

```bash
cd /opt/hams/current/backend
sudo -u hams env PATH="/opt/hams-tools/bin:/opt/hams-node/bin:/usr/bin:/bin" pnpm run prisma:bootstrap-admins
```

ให้เจ้าของทั้งสองรับอีเมลรหัสผ่านและ verification, กดลิงก์, login, ลงทะเบียน authenticator และเก็บ recovery codes จากนั้น:

```bash
sudo -u hams env PATH="/opt/hams-tools/bin:/opt/hams-node/bin:/usr/bin:/bin" pnpm run prisma:handover-check
```

ต้องผ่านทั้งสองคน อีเมล provider ขึ้น Sent อย่างเดียวไม่พอ ต้องรับจริงและกดลิงก์ได้ หากส่งล้มเหลวแก้ SMTP แล้ว rerun bootstrap ได้โดยไม่เปลี่ยน encryption key เดิม

ความหมายของคำสั่งขั้น 12:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `cd /opt/hams/current/backend` | ใช้ scripts และ environment ของ release ที่ส่งมอบ |
| `sudo -u hams env PATH=... pnpm run prisma:bootstrap-admins` | สร้าง/ดำเนินการส่งมอบ ADMIN ตามสองตัวตนใน config และส่งอีเมลจริง; รันด้วยสิทธิ์ service เพื่อใช้ค่าเดียวกับแอป |
| `sudo -u hams env PATH=... pnpm run prisma:handover-check` | ตรวจว่าผู้ดูแลทั้งสอง active มี role ADMIN ยืนยันอีเมลและลงทะเบียน 2FA แล้ว; เป็นการตรวจ ไม่ได้ทำขั้นตอนเหล่านี้แทนเจ้าของบัญชี |

ผลที่ต้องได้: เจ้าของบัญชีเข้าใช้ได้จริงและ handover-check จบสำเร็จ ถ้ายังไม่ผ่านต้องดูว่าบัญชีใดค้างขั้นไหน

## 13. ทดสอบรับงานผ่านหน้าเว็บ

- เปิดจากเครื่องเจ้าหน้าที่จริงผ่าน HTTPS, refresh deep link เช่น `/asset-stock` ไม่ 404
- Login/2FA, reload session, logout แล้วเข้า API ที่ต้อง login ไม่ได้
- สิทธิ์ ADMIN และ role งานจริงถูกต้อง รวมกรณีผู้ไม่มีสิทธิ์อ่านรูปบุคลากร
- Upload/preview/save/read/replace รูปครุภัณฑ์และบุคลากร: JPEG, PNG, static WebP, HEIC/HEIF; ไฟล์จริงอยู่ storage ที่กำหนด; error ไม่ทำให้รูปเดิมหาย
- retry/lost response/cleanup ทดสอบบนฐานและ storage ทดสอบแยก ไม่ฉีด fault ใส่ข้อมูล production
- แจ้งเตือน SSE ส่งถึง browser และ reconnect หลัง restart ได้
- Gemini disabled แล้วยังอ่านประวัติรายจ่าย/อายุครุภัณฑ์ได้ และไม่มีการเรียก Gemini
- ทดสอบ flow งานหลักของโรงพยาบาลและข้อมูลอ้างอิง/หน่วยงานจริงที่เตรียมไว้
- วัดการใช้ RAM/disk และเวลาแปลง HEIC บนเครื่องนี้ ไม่ใช้ผล Windows รับรอง Linux

ตรวจ log ที่ `sudo journalctl -u hams-backend -f`, `/var/log/nginx/error.log`, `/var/log/nginx/access.log` และ provider SMTP โดยระวัง URL verification มี token; จำกัดผู้เข้าถึงและ retention ของ log

ในช่วง maintenance ที่ตกลงไว้ ทดสอบ `sudo systemctl restart hams-backend` และ reboot เครื่องเมื่อได้รับอนุญาต ตรวจหลังเปิดว่า Nginx, PostgreSQL, HAMS กลับมาทำงานและรูป/DB ยังอยู่ ไม่ reboot เครื่องที่มีบริการอื่นโดยไม่ตรวจผลกระทบ

คำสั่งประกอบการตรวจขั้น 13:

| คำสั่ง/ตำแหน่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `sudo journalctl -u hams-backend -f` | ติดตาม log backend ต่อเนื่องขณะทดสอบ; กด Ctrl+C หยุดดู log โดยไม่หยุดแอป |
| `/var/log/nginx/error.log` | ไฟล์ข้อผิดพลาด proxy/TLS/การอ่านไฟล์; ดูต่อเนื่องด้วย `sudo tail -f /var/log/nginx/error.log` |
| `/var/log/nginx/access.log` | ไฟล์รายการ request/HTTP status; ดูด้วย `sudo tail -n 100 /var/log/nginx/access.log` เพื่อหาคำขอที่ 4xx/5xx และจำกัดการเปิดเผย token ใน URL |
| `sudo systemctl restart hams-backend` | หยุดแล้วเปิด backend ใหม่ ทำให้ request/SSE ที่กำลังค้างสะดุดได้ ใช้ทดสอบการกลับมาทำงานในช่วงที่ตกลง |
| `sudo reboot` | รีสตาร์ตทั้งเครื่อง ตัด SSH และกระทบทุกบริการ ใช้เฉพาะเมื่ออนุญาตช่วงหยุดเครื่องแล้ว เพื่อทดสอบ autostart |

## 14. Backup และซ้อม restore ก่อนเปิดจริง

สำรอง **DB + images + image-temp + secrets/encryption key + revision/config** เป็นชุดเดียวกัน ไม่ใช่เก็บเฉพาะ source code ตัวอย่างต่อไปหยุด HAMS ชั่วครู่ให้ DB/files ไม่เปลี่ยนระหว่าง backup จึงใช้เฉพาะช่วงนอกเวลางานที่อนุมัติ

เปิด root shell เพื่อให้ redirect สร้าง backup ด้วย root และหยุดเมื่อคำสั่งผิดพลาด:

```bash
sudo bash
set -euo pipefail
umask 077
BACKUP_DIR="/var/backups/hams/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
systemctl stop hams-backend
trap 'systemctl start hams-backend' EXIT
runuser -u postgres -- pg_dump -p 5432 -Fc hams_prod > "$BACKUP_DIR/database.dump"
tar -C /var/lib/hams -czf "$BACKUP_DIR/images.tar.gz" images image-temp
tar -czf "$BACKUP_DIR/config.tar.gz" -C / etc/hams etc/nginx/sites-available/hams etc/systemd/system/hams-backend.service
readlink -f /opt/hams/current > "$BACKUP_DIR/release-path.txt"
/opt/hams-node/bin/node --version > "$BACKUP_DIR/node-version.txt"
sha256sum "$BACKUP_DIR/database.dump" "$BACKUP_DIR/images.tar.gz" "$BACKUP_DIR/config.tar.gz" > "$BACKUP_DIR/SHA256SUMS"
systemctl start hams-backend
trap - EXIT
exit
```

ถ้า backup ล้มเหลว อย่าใช้ชุดที่ไม่ครบเป็น restore point ตรวจ service กลับมาทำงาน จากนั้นส่งชุด backup ไป NAS/backup server ที่ IT อนุมัติผ่านช่องทางเข้ารหัสและจำกัดสิทธิ์ config archive มี private key และ secret; backup บน disk เครื่องเดียวไม่ป้องกันเครื่องเสีย

กำหนดตาราง/retention/การแจ้งเมื่อ backup ล้มเหลวตามลูกค้า ตัวอย่างเริ่มต้นเสนอ nightly หลังเลิกงาน แต่ไม่ติดตั้งตารางหยุดระบบจนตกลงช่วงเวลาแล้ว วิธีทำ automation ใช้สคริปต์ชุดข้างต้นพร้อม log/alert และ systemd timer หรือเครื่องมือ backup ของ IT

ซ้อม restore บน Ubuntu/DB/storage แยก: สร้างฐานใหม่ → `pg_restore --no-owner --no-acl --role=hams_app -d RESTORE_DB database.dump` ด้วยผู้ดูแล DB → คืน image roots และ temp พร้อม owner hams/mode → คืน config แต่เปลี่ยน DB/URL/storage/SMTP เป็นของระบบ restore → ใช้ release เดิม → ตรวจ login/2FA/รูป/สิทธิ์ ห้ามเปิดระบบ restore ด้วย URL หรือ SMTP production และห้ามสั่ง restore ทับ hams_prod เพื่อทดลอง บันทึกเวลาที่ใช้กู้คืนจริง

ความหมายของคำสั่งขั้น 14:

| คำสั่ง | ทำอะไรและใช้เพื่ออะไร |
| --- | --- |
| `sudo bash` | เปิด Bash ด้วยสิทธิ์ root ให้การสร้างไฟล์ผ่าน `>` มีสิทธิ์ถูกต้อง; คำสั่งต่อจากนี้ใช้สิทธิ์สูงจน `exit` |
| `set -euo pipefail` | ให้ shell นี้หยุดเมื่อคำสั่งล้มเหลวตามกฎ Bash, ใช้ตัวแปรที่ไม่มีค่า หรือ pipeline ล้มเหลว ช่วยไม่ให้เดินหน้าทั้งที่ backup เสีย |
| `umask 077` | กำหนดให้ไฟล์/โฟลเดอร์ใหม่เข้าถึงได้เฉพาะเจ้าของ เพราะ backup มีข้อมูลและ secrets |
| `BACKUP_DIR="...$(date +%Y%m%d-%H%M%S)"` | ตั้งโฟลเดอร์ตามวันเวลาเครื่อง เพื่อแยกแต่ละรอบ backup |
| `mkdir -p "$BACKUP_DIR"` | สร้างโฟลเดอร์ backup และ parent ที่ยังไม่มี |
| `systemctl stop hams-backend` | หยุดงานของแอปและ cleanup ก่อนเก็บ DB/files ให้สอดคล้องกัน ต้องไม่มีผู้เขียนข้อมูลอื่นระหว่างนี้ |
| `trap 'systemctl start hams-backend' EXIT` | กำหนดให้ลองเปิดแอปคืนเมื่อ shell ออก รวมกรณี backup error; ไม่รับประกันกรณีไฟดับหรือ process ถูก kill แบบบังคับ |
| `runuser -u postgres -- pg_dump -p 5432 -Fc hams_prod > ...` | ใช้ Linux user postgres สำรอง DB เป็น PostgreSQL custom archive (`-Fc`); root เป็นผู้สร้างไฟล์ปลายทางผ่าน `>` |
| `tar -C /var/lib/hams -czf ... images image-temp` | บีบอัดพื้นที่รูปและ staging ทั้งชุด; `-c` สร้าง archive, `-z` gzip, `-f` ระบุชื่อไฟล์ โดยใช้ path relative จาก `-C` |
| `tar -czf ... -C / etc/hams ...` | สำรอง config/secrets/TLS/service/Nginx เพื่อกู้ environment เดิมได้ ต้องปกป้อง archive นี้เหมือน private key |
| `readlink -f /opt/hams/current > ...` | บันทึก path release จริงหลังตาม symlink เพื่อเลือกโค้ดรุ่นเดียวกับข้อมูลที่สำรอง |
| `/opt/hams-node/bin/node --version > ...` | บันทึกรุ่น runtime สำหรับการกู้คืน |
| `sha256sum ... > .../SHA256SUMS` | สร้าง checksum ของสาม archive เพื่อใช้ตรวจความครบหลังคัดลอก; checksum ไม่ใช่การเข้ารหัสข้อมูล |
| `systemctl start hams-backend` | เปิดบริการคืนหลังเก็บ backup ครบ |
| `trap - EXIT` | ยกเลิกคำสั่งอัตโนมัติตอนออก เพราะเปิดแอปคืนแล้ว |
| `exit` | ออกจาก root shell กลับบัญชีติดตั้งตามปกติ |
| `pg_restore --no-owner --no-acl --role=hams_app -d RESTORE_DB database.dump` | คืน DB ไปฐานซ้อมกู้คืนที่สร้างไว้; ไม่ใช้ owner/ACL เดิมจาก archive และใช้ role hams_app สร้างวัตถุ ผู้เรียกต้องมีสิทธิ์ใช้ role นี้และเข้าฐานปลายทางได้ |

ผลที่ต้องได้: backup ครบทั้ง DB/files/config, แอปเปิดคืนสำเร็จ, มีสำเนานอกเครื่อง และซ้อมกู้คืนแล้วอ่านข้อมูล/รูปได้จริง การมีไฟล์ dump อย่างเดียวไม่ยืนยันว่ากู้ระบบได้

## 15. เมื่อไรจึงนับว่า deploy เสร็จ

- frontend/backend เป็น release เดียวกัน; migrations/seed ผ่าน; ไม่ปน demo
- browser อีกเครื่องใช้งาน HTTPS โดยไม่เตือน certificate
- SMTP รับจริง, ADMIN สองคนผ่าน handover check และข้อมูลโรงพยาบาลพร้อม
- flow หลัก/รูป/สิทธิ์/SSE ผ่าน และ service กลับมาทำงานหลัง restart/reboot ตามแผน
- DB และรูปอยู่ที่ถาวร, backup นอกเครื่อง + restore rehearsal ผ่าน
- บันทึก Ubuntu/architecture, Node/pnpm/PostgreSQL/package versions, commit SHA, ผล pass/fail และข้อค้าง
- IT ได้คู่มือ log/start-stop, วิธีต่ออายุ certificate, backup/restore และเวลาทำงานดูแลระบบ

อัปเดตครั้งต่อไปให้ build release ใหม่ใน directory ใหม่, backup ก่อน migrate, หยุดตาม maintenance, เปลี่ยน symlink และ frontend พร้อมกัน แล้วตรวจซ้ำ การสลับโค้ดกลับไม่ได้ย้อน schema ถ้ามี migration ที่ไม่ backward-compatible ต้องใช้แผน restore DB/files ชุดเดียวกันและยอมรับข้อมูลหลัง restore point ที่จะสูญเสีย ไม่ใช้ git pull ทับ live release

## ขอบเขตหลักฐานของเอกสารนี้

ตรวจจาก `backend/package.json`, `scripts/start-production.cjs`, Prisma config/schema/migrations, bootstrap, runtime config, image normalizer/storage, frontend apiClient/vite config และเอกสาร ticket ณ วันที่ด้านบน ยังไม่ได้รันคำสั่ง Linux ในคู่มือนี้ ไม่ได้เชื่อมต่อ server ลูกค้า และไม่ได้ปิด acceptance ของ ticket ที่ยังค้าง คู่มือต้องซ้อมบน Ubuntu รุ่น/architecture เป้าหมายก่อนรับรองการติดตั้ง

เอกสารอ้างอิงเพิ่มเติม: [systemd service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html), [pnpm installation](https://pnpm.io/installation/), [Nginx proxy buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering) คำสั่ง Prisma ในเอกสารยึด CLI 7 ของ repo; docs เว็บรุ่นใหม่อาจใช้คำสั่งคนละรุ่น
