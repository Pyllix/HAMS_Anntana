/**
 * departmentStore.ts
 *
 * ตอนนี้ใช้ mock data — พอต่อ backend จริงแค่เปลี่ยน block ── MOCK ──
 * ให้เรียก sectionService แทน แล้วเพิ่ม isLoading/error กลับมา
 *
 * TODO (Backend): แทนที่ด้วย async call เช่น
 *   fetchAll: async () => { const data = await sectionService.getAll(); set({ sections: data }) }
 */

import { create } from "zustand"
import type { Section, CreateSectionInput, UpdateSectionInput } from "@/types/SectionType"
import { mockSections } from "@/mock-up/mockSectionData"

interface DepartmentState {
  sections: Section[]
  searchQuery: string

  setSearchQuery: (q: string) => void
  addSection: (input: CreateSectionInput) => void
  editSection: (id: string, input: UpdateSectionInput) => void
  removeSection: (id: string) => void
}

export const useDepartmentStore = create<DepartmentState>((set) => ({
  // ── MOCK ──────────────────────────────────────────────────────────────────
  sections: mockSections,
  // ── END MOCK ──────────────────────────────────────────────────────────────

  searchQuery: "",

  setSearchQuery: (q) => set({ searchQuery: q }),

  addSection: (input) =>
    set((state) => ({
      sections: [
        {
          id: crypto.randomUUID(),
          code: input.code,
          name: input.name,
          tel: input.tel ?? "",
          building: input.building ?? "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...state.sections,
      ],
    })),

  editSection: (id, input) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === id ? { ...s, ...input, updatedAt: new Date().toISOString() } : s
      ),
    })),

  removeSection: (id) =>
    set((state) => ({
      sections: state.sections.filter((s) => s.id !== id),
    })),
}))
