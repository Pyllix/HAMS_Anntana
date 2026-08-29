/**
 * userManagementStore.ts
 *
 * ตอนนี้ใช้ mock data — พอต่อ backend จริงแค่เปลี่ยน block ── MOCK ──
 * ให้เรียก userService แทน แล้วเพิ่ม isLoading/error กลับมา
 */

import { create } from "zustand"
import type {
  ManagedUser,
  CreateUserInput,
  UpdateUserInput,
  SystemRole,
  AccountStatus,
} from "@/types/userManagementTypes"
import { mockUsers } from "@/mock-up/mockUserData"

interface UserManagementState {
  users: ManagedUser[]
  searchQuery: string
  roleFilter: SystemRole | "all"
  statusFilter: AccountStatus | "all"

  setSearchQuery: (q: string) => void
  setRoleFilter: (role: SystemRole | "all") => void
  setStatusFilter: (status: AccountStatus | "all") => void
  addUser: (input: CreateUserInput) => void
  editUser: (id: string, input: UpdateUserInput) => void
  removeUser: (id: string) => void
}

export const useUserManagementStore = create<UserManagementState>((set) => ({
  // ── MOCK ──────────────────────────────────────────────────────────────────
  users: mockUsers,
  // ── END MOCK ──────────────────────────────────────────────────────────────

  searchQuery: "",
  roleFilter: "all",
  statusFilter: "all",

  setSearchQuery: (q) => set({ searchQuery: q }),
  setRoleFilter: (role) => set({ roleFilter: role }),
  setStatusFilter: (status) => set({ statusFilter: status }),

  addUser: (input) =>
    set((state) => ({
      users: [
        {
          id: crypto.randomUUID(),
          empCode: input.empCode,
          name: input.name,
          email: input.email,
          phone: "",
          department: input.department,
          role: input.role,
          status: "active",
          createdAt: new Date().toISOString(),
          lastLogin: "-",
        },
        ...state.users,
      ],
    })),

  editUser: (id, input) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === id ? { ...u, ...input } : u
      ),
    })),

  removeUser: (id) =>
    set((state) => ({
      users: state.users.filter((u) => u.id !== id),
    })),
}))

