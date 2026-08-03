import { useState, useMemo, useEffect } from "react"
import { Search, Plus } from "lucide-react"
import { useDepartmentStore } from "@/stores/departmentStore"
import type { Section } from "@/types/SectionType"

import { DepartmentTable } from "@/components/department/DepartmentTable"
import { DepartmentAddDialog } from "@/components/department/DepartmentAddDialog"
import { DepartmentEditDialog } from "@/components/department/DepartmentEditDialog"
import { DepartmentDeleteDialog } from "@/components/department/DepartmentDeleteDialog"

// ✅ reuse ManageBorrowPagination — props เหมือนกัน 100%
import { ManageBorrowPagination } from "@/components/manageborrow/ManageBorrowPagination"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group/input-group"

const PAGE_SIZE = 6

export default function DepartmentPage() {
  const store = useDepartmentStore()
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState<Section | null>(null)
  const [modals, setModals] = useState({ add: false, edit: false, delete: false })

  // reset หน้าเมื่อ search เปลี่ยน
  useEffect(() => {
    setPage(1)
  }, [store.searchQuery])

  // filter ด้วย search
  const filtered = useMemo(() => {
    const q = store.searchQuery.toLowerCase().trim()
    if (!q) return store.sections
    return store.sections.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
    )
  }, [store.sections, store.searchQuery])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  return (
    <div className="flex w-full flex-col gap-5 bg-[#f8fafc] p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">รายชื่อแผนก</h2>
        <button
          onClick={() => setModals((m) => ({ ...m, add: true }))}
          className="flex items-center gap-2 rounded-xl bg-[#00966c] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-[#007d5a] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          เพิ่มแผนกใหม่
        </button>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Search bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-white px-5 py-3">
          <InputGroup className="w-64 rounded-xl border border-slate-200 bg-slate-50">
            <InputGroupInput
              placeholder="ค้นหาแผนก, รหัสแผนก..."
              value={store.searchQuery}
              onChange={(e) => store.setSearchQuery(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Search className="h-4 w-4 text-slate-400" />
            </InputGroupAddon>
          </InputGroup>
        </div>

        <DepartmentTable
          sections={paged}
          onEdit={(section) => {
            setSelected(section)
            setModals((m) => ({ ...m, edit: true }))
          }}
          onDelete={(section) => {
            setSelected(section)
            setModals((m) => ({ ...m, delete: true }))
          }}
        />

        {/* ✅ reuse ManageBorrowPagination */}
        <ManageBorrowPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>

      {/* Dialogs */}
      <DepartmentAddDialog
        isOpen={modals.add}
        onClose={() => setModals((m) => ({ ...m, add: false }))}
        onConfirm={(data) => {
          store.addSection(data)
          setModals((m) => ({ ...m, add: false }))
        }}
      />

      <DepartmentEditDialog
        isOpen={modals.edit}
        section={selected}
        onClose={() => setModals((m) => ({ ...m, edit: false }))}
        onConfirm={(id, data) => {
          store.editSection(id, data)
          setModals((m) => ({ ...m, edit: false }))
        }}
      />

      <DepartmentDeleteDialog
        isOpen={modals.delete}
        section={selected}
        onClose={() => setModals((m) => ({ ...m, delete: false }))}
        onConfirm={() => {
          if (selected) store.removeSection(selected.id)
          setModals((m) => ({ ...m, delete: false }))
          setSelected(null)
        }}
      />
    </div>
  )
}
