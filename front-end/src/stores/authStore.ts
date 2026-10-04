import { create } from "zustand";
import type { User } from "../types/TypeUser";
import type { PreAuthStep } from "../types/AuthFlow";
import type { RoleType } from "../router/roles";
import type { SessionDeadlines } from "../services/authService";
import { clearLegacyBrowserAuthStorage } from "../services/legacyAuthStorage";
import { clearEmployeePhotoGrantCache } from "../services/employeePhotoGrantCache";

interface AuthState {
  user: User | null;
  role: RoleType | null;
  session: SessionDeadlines | null;
  isAuthenticated: boolean;
  preAuthStep: PreAuthStep | null;
  login: (user: User, session: SessionDeadlines) => void;
  enterPreAuth: (step: PreAuthStep) => void;
  updateUserPhoto: (photo: Pick<User, "hasEmployeePhoto" | "photoRevision" | "imageUrl">) => void;

  updateSession: (session: SessionDeadlines) => void;
  logout: () => void;
}

clearLegacyBrowserAuthStorage();

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  session: null,
  isAuthenticated: false,
  preAuthStep: null,
  login: (user, session) => {
    clearLegacyBrowserAuthStorage();
    clearEmployeePhotoGrantCache();
    set({
      user,
      role: user.role,
      session,
      isAuthenticated: true,
      preAuthStep: null,
    });
  },
  enterPreAuth: (step) => {
    clearLegacyBrowserAuthStorage();
    clearEmployeePhotoGrantCache();
    set({
      user: null,
      role: null,
      session: null,
      isAuthenticated: false,
      preAuthStep: step,
    });
  },
  updateUserPhoto: (photo) => set((state) => state.user
    ? { user: { ...state.user, ...photo } }
    : state),

  updateSession: (session) => set({ session }),
  logout: () => {
    clearLegacyBrowserAuthStorage();
    clearEmployeePhotoGrantCache();
    set({
      user: null,
      role: null,
      session: null,
      isAuthenticated: false,
      preAuthStep: null,
    });
  },
}));
