/**
 * sectionService.ts
 *
 * Service layer สำหรับ Department (Section) Management
 * ติดต่อ backend ผ่าน GET/POST/PATCH/DELETE /sections
 *
 * NOTE: backend ใช้ better-auth cookie session
 *   → ส่ง credentials: "include" ทุก request เพื่อแนบ session cookie
 *   → ถ้า 401 หมายความว่ายังไม่ได้ login จริงกับ backend
 */

import type { Section, CreateSectionInput, UpdateSectionInput } from "@/types/SectionType"

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

// ── Helper ────────────────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // พยายามอ่าน error message จาก backend ก่อน
    const body = await res.json().catch(() => null)
    const message =
      body?.message ?? `Request failed with status ${res.status}`
    throw new Error(Array.isArray(message) ? message.join(", ") : message)
  }
  return res.json() as Promise<T>
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const sectionService = {
  /**
   * GET /sections
   * ดึงรายการแผนกทั้งหมด (เฉพาะที่ยังไม่ถูก soft-delete)
   */
  getAll: (): Promise<Section[]> =>
    fetch(`${BASE_URL}/sections`, {
      credentials: "include",
    }).then((res) => handleResponse<Section[]>(res)),

  /**
   * GET /sections/:id
   * ดึงข้อมูลแผนกรายตัว
   */
  getOne: (id: string): Promise<Section> =>
    fetch(`${BASE_URL}/sections/${id}`, {
      credentials: "include",
    }).then((res) => handleResponse<Section>(res)),

  /**
   * POST /sections
   * สร้างแผนกใหม่
   * → 409 Conflict ถ้า code ซ้ำ
   */
  create: (input: CreateSectionInput): Promise<Section> =>
    fetch(`${BASE_URL}/sections`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((res) => handleResponse<Section>(res)),

  /**
   * PATCH /sections/:id
   * แก้ไขข้อมูลแผนก (partial update)
   */
  update: (id: string, input: UpdateSectionInput): Promise<Section> =>
    fetch(`${BASE_URL}/sections/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((res) => handleResponse<Section>(res)),

  /**
   * DELETE /sections/:id
   * Soft delete แผนก (ยังอยู่ใน DB แต่ไม่แสดงใน list)
   */
  remove: (id: string): Promise<Section> =>
    fetch(`${BASE_URL}/sections/${id}`, {
      method: "DELETE",
      credentials: "include",
    }).then((res) => handleResponse<Section>(res)),
}
