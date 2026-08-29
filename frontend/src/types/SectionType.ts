/**
 * SectionType.ts
 *
 * Types สำหรับ Department (Section) Management
 * map ตรงกับ backend schema: sections table
 */

// ── Response จาก GET /sections และ GET /sections/:id ─────────────────────────
export interface Section {
  id: string
  code: string     // รหัสแผนก / ตัวย่อ เช่น "ADM", "PHA"
  name: string     // ชื่อแผนก เช่น "งานบริหารทั่วไปและงานสารบัญ"
  tel: string      // เบอร์โทรภายใน เช่น "123"
  building: string // อาคาร / สถานที่ตั้ง เช่น "อาคาร 1 ชั้น 2"
  createdAt: string
  updatedAt: string
}

// ── Body สำหรับ POST /sections ────────────────────────────────────────────────
export interface CreateSectionInput {
  code: string      // required, max 20 chars, unique
  name: string      // required, max 255 chars
  tel?: string      // optional, max 20 chars
  building?: string // optional, max 100 chars
}

// ── Body สำหรับ PATCH /sections/:id ──────────────────────────────────────────
export type UpdateSectionInput = Partial<CreateSectionInput>
