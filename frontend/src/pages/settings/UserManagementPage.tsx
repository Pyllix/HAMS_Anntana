import { useState, useMemo, useEffect } from "react"
import { UserPlus } from "lucide-react"
import { useUserManagementStore } from "@/stores/userManagementStore"
import type { ManagedUser } from "@/types/userManagementTypes"

import { UserFilterBar } from "@/components/usermanagement/UserFilterBar"
import { UserTable } from "@/components/usermanagement/UserTable"
import { UserViewDialog } from "@/components/usermanagement/UserViewDialog"
import { UserEditDialog } from "@/components/usermanagement/UserEditDialog"
import { UserDeleteDialog } from "@/components/usermanagement/UserDeleteDialog"
import { UserAddDialog } from "@/components/usermanagement/UserAddDialog"
import { ManageBorrowPagination } from "@/components/manageborrow/ManageBorrowPagination"

const PAGE_SIZE = 6

export default function UserManagementPage() {
  const store = useUserManagementStore()
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState<ManagedUser | null>(null)
  const [modals, setModals] = useState({
    add: false,
    view: false,
    edit: false,
    delete: false,
  })

  // reset page when search or filters change
  useEffect(() => {
    setPage(1)
  }, [store.searchQuery, store.roleFilter, store.statusFilter])

  // filter by search, role, and status
  const filtered = useMemo(() => {
    return store.users.filter((u) => {
      // role filter
      const matchRole =
        store.roleFilter === "all" || u.role === store.roleFilter

      // status filter
      const matchStatus =
        store.statusFilter === "all" || u.status === store.statusFilter

      // search
      const q = store.searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.empCode.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)

      return matchRole && matchStatus && matchSearch
    })
  }, [store.users, store.searchQuery, store.roleFilter, store.statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const paged = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  return (
    <div className="flex w-full flex-col gap-4 bg-[#f8fafc] p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">
          รายชื่อบุคลากรและสิทธิ์
        </h2>
        <button
          onClick={() => setModals((m) => ({ ...m, add: true }))}
          className="flex items-center gap-2 rounded-xl bg-[#00966c] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#007d5a] active:scale-[0.98]"
        >
          <UserPlus className="h-5 w-5" />
          เพิ่มผู้ใช้ใหม่
        </button>
      </div>

      {/* Filter bar – separate from table */}
      <UserFilterBar />

      {/* User table – separate card */}
      <UserTable
        users={paged}
        onView={(user) => {
          setSelected(user)
          setModals((m) => ({ ...m, view: true }))
        }}
        onEdit={(user) => {
          setSelected(user)
          setModals((m) => ({ ...m, edit: true }))
        }}
        onDelete={(user) => {
          setSelected(user)
          setModals((m) => ({ ...m, delete: true }))
        }}
      />

      {/* Pagination – reuse ManageBorrowPagination */}
      <ManageBorrowPagination
        page={safePage}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onPageChange={setPage}
      />

      {/* Dialogs */}
      <UserAddDialog
        isOpen={modals.add}
        onClose={() => setModals((m) => ({ ...m, add: false }))}
        onConfirm={(data) => {
          store.addUser(data)
          setModals((m) => ({ ...m, add: false }))
        }}
      />

      <UserViewDialog
        isOpen={modals.view}
        user={selected}
        onClose={() => setModals((m) => ({ ...m, view: false }))}
        onEdit={(user) => {
          setModals((m) => ({ ...m, view: false, edit: true }))
        }}
      />

      <UserEditDialog
        isOpen={modals.edit}
        user={selected}
        onClose={() => setModals((m) => ({ ...m, edit: false }))}
        onConfirm={(id, data) => {
          store.editUser(id, data)
          setModals((m) => ({ ...m, edit: false }))
        }}
      />

      <UserDeleteDialog
        isOpen={modals.delete}
        user={selected}
        onClose={() => setModals((m) => ({ ...m, delete: false }))}
        onConfirm={() => {
          if (selected) store.removeUser(selected.id)
          setModals((m) => ({ ...m, delete: false }))
          setSelected(null)
        }}
      />
    </div>
  )
}
