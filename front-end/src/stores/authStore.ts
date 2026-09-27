import { create } from "zustand";
import type { User } from "../types/TypeUser";
import type { PreAuthStep } from "../types/AuthFlow";
import type { RoleType } from "../router/roles";
import type { SessionDeadlines } from "../services/authService";

interface AuthState {
  user: User | null;
  role: RoleType | null;
  session: SessionDeadlines | null;
  isAuthenticated: boolean;
  preAuthStep: PreAuthStep | null;
  login: (user: User, session: SessionDeadlines) => void;
  enterPreAuth: (step: PreAuthStep) => void;

  updateSession: (session: SessionDeadlines) => void;
  logout: () => void;
}

function clearLegacyBrowserTokens(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  session: null,
  isAuthenticated: false,
  preAuthStep: null,
  login: (user, session) =>
    set({
      user,
      role: user.role,
      session,
      isAuthenticated: true,
      preAuthStep: null,
    }),
  enterPreAuth: (step) => {
    clearLegacyBrowserTokens();
    set({
      user: null,
      role: null,
      session: null,
      isAuthenticated: false,
      preAuthStep: step,
    });
  },

  updateSession: (session) => set({ session }),
  logout: () => {
    clearLegacyBrowserTokens();
    set({
      user: null,
      role: null,
      session: null,
      isAuthenticated: false,
      preAuthStep: null,
    });
  },
}));
