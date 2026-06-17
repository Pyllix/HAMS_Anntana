import { create } from "zustand"
import type { User, UserRole, LoginPayload, AuthState } from "@/types/user"

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  role: null,
  isAuthenticated: false,

  login: (userData) =>
    set({
      user: userData.user,
      token: userData.token,
      role: userData.role,
      isAuthenticated: true,
    }),

  logout: () =>
    set({ user: null, token: null, role: null, isAuthenticated: false }),
}))
