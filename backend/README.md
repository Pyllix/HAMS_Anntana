# Hospital Asset & Maintenance System (HAMS)

## Project Overview

The **Hospital Asset & Maintenance System (HAMS)** is a centralized web application designed to manage hospital assets and maintenance workflows. It ensures all departments have access to a single source of truth for assets, minimizing data redundancy, and enabling real-time asset tracking.

Based on the system documentation, the project's core modules include:
- **User & Access Control:** Role-based access control for Parcel Staff, Asset Center Staff, Department Staff, Maintenance Staff, Managers, and Admins.
- **Asset Management:** Registering, tracking, and viewing the statuses of hospital equipment (e.g., active, broken, under repair, disposed).
- **Borrow & Return Management:** Managing borrowing procedures, calculating usage duration, and maintaining borrow histories.
- **Spare Parts Requisition:** Managing inventory and automatically deducting spare parts used in maintenance operations.
- **Maintenance Management:** Creating repair tickets, tracking maintenance progress, and recording repairs and parts used.
- **Asset Audit:** Recording asset counting results to compare against the system's database.
- **Reports & Dashboard:** Providing executive summaries and data-driven insights for hospital management.

## Tech Stack

This repository contains the backend service for HAMS, built with:
- **Framework:** [NestJS](https://nestjs.com/) (v11)
- **Language:** TypeScript
- **Package Manager:** pnpm
- **Testing:** Jest & Supertest
- **Code Quality:** ESLint & Prettier

## Getting Started (Step-by-Step Guide for Frontend Developers)

สำหรับการเตรียมความพร้อมของ Backend เพื่อให้นำไปเชื่อมต่อกับ Frontend ได้ มีขั้นตอนดังนี้:

### 1. Prerequisites (สิ่งที่ต้องมี)
- [Node.js](https://nodejs.org/) (แนะนำเวอร์ชัน 18 ขึ้นไป)
- [pnpm](https://pnpm.io/installation) (`npm install -g pnpm`)
- [Docker](https://www.docker.com/products/docker-desktop/) (สำหรับรัน Database)

### 2. ติดตั้ง Dependencies
เปิด Terminal ในโฟลเดอร์ `backend` แล้วรันคำสั่ง:
```bash
pnpm install
```

### 3. ตั้งค่า Environment Variables (.env)
คัดลอกไฟล์ `.env.example` แล้วเปลี่ยนชื่อเป็น `.env`:
```bash
cp .env.example .env
```
ตรวจสอบและแก้ไขค่าในไฟล์ `.env` (ค่าเริ่มต้นสามารถใช้งานกับ Docker ด้านล่างได้เลย):
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/hams_db?schema=public"
BETTER_AUTH_SECRET="your_better_auth_secret" # สามารถนำ secret มาใส่ได้จาก https://better-auth-secret.com/
BETTER_AUTH_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5173" # ปรับให้ตรงกับ port ของ frontend ที่ใช้
DATABASE_NAME="hams_db"
DATABASE_USER="postgres"
DATABASE_PASSWORD="password"
```

### 4. รัน Database ด้วย Docker
โปรเจกต์นี้ใช้ PostgreSQL รันผ่าน Docker Compose:
```bash
docker compose up -d
```
*(ถ้าต้องการปิด Database ให้ใช้คำสั่ง `docker compose down`)*

**การเปิดดู Database ด้วย DBeaver (Optional):**
หากต้องการใช้โปรแกรม [DBeaver](https://dbeaver.io/) จัดการฐานข้อมูล ให้สร้าง Connection ใหม่ด้วยข้อมูลดังนี้:
- **Database Type**: PostgreSQL
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `hams_db`
- **Username**: `postgres`
- **Password**: `password`
*(ค่าทั้งหมดอ้างอิงจากไฟล์ `.env` ที่ตั้งไว้)*


### 5. ตั้งค่า Database Schema (Prisma)
หลังจาก Database รันขึ้นมาแล้ว ให้รันคำสั่งเพื่อสร้าง Table และเพิ่มข้อมูลจำลอง (Seed data) เบื้องต้น:
```bash
pnpm run prisma:reset
```
*(คำสั่งนี้จะทำการ generate client, migrate database, และ seed ข้อมูลให้ครบจบในคำสั่งเดียว)*
*(หมายเหตุ: สามารถใช้คำสั่ง `pnpm run prisma:studio` เพื่อเปิดหน้าเว็บสำหรับดูและแก้ไขข้อมูลใน Database ได้ตลอดเวลา)*

### 6. รัน Backend Server
เริ่มการทำงานของ Backend API ในโหมด Development:
```bash
pnpm run start:dev
```
Backend จะทำงานที่ `http://localhost:3000` 
- ลองทดสอบ API Reference (Swagger/Scalar) ได้ที่: `http://localhost:3000/reference`

---

## Development Commands

รวมคำสั่งอื่นๆ ที่ใช้บ่อยสำหรับการพัฒนา (รันผ่าน `package.json`):

```bash
pnpm start          # Start the application
pnpm run start:dev  # Start in development (watch) mode
pnpm run build      # Build the application for production
pnpm run format     # Format source files using Prettier
pnpm run lint       # Lint source files using ESLint
pnpm run test       # Run unit tests
pnpm dlx prisma studio # เปิด UI สำหรับดูข้อมูลใน Database ของ Prisma
```

## Project Structure

```text
/
├── docs/                     # System documentation (SRS, Use Cases, Project Report)
├── src/                      # Application source code
│   ├── app.module.ts         # Root module of the application
│   └── main.ts               # Entry file of the application
├── test/                     # End-to-end testing files and configurations
│   ├── app.e2e-spec.ts       # E2E test specifications
│   └── jest-e2e.json         # Jest E2E configuration 
├── eslint.config.mjs         # ESLint configuration
├── nest-cli.json             # NestJS CLI configuration
├── package.json              # Project dependencies and scripts
├── pnpm-lock.yaml            # pnpm dependency lockfile
├── pnpm-workspace.yaml       # pnpm workspace configuration
├── tsconfig.json             # TypeScript compiler configuration
└── tsconfig.build.json       # TypeScript build configuration
```
