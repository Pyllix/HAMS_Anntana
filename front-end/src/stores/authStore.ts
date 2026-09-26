import { create } from "zustand";
import type { User } from "../types/TypeUser";
import type { RoleType } from "../router/roles";
import type { SessionDeadlines } from "../services/authService";

interface AuthState {
  user: User | null;
  role: RoleType | null;
  session: SessionDeadlines | null;
  isAuthenticated: boolean;
  login: (user: User, session: SessionDeadlines) => void;
  updateSession: (session: SessionDeadlines) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  session: null,
  isAuthenticated: false,
  login: (user, session) =>
    set({
      user,
      role: user.role,
      session,
      isAuthenticated: true,
    }),
  updateSession: (session) => set({ session }),
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    set({
      user: null,
      role: null,
      session: null,
      isAuthenticated: false,
    });
  },
}));