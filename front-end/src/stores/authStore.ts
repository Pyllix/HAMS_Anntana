import { create } from "zustand";
import { User, UserRole } from "../types/TypeUser";

interface AuthState {
  user: User | null;
  role: UserRole | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  token: null,
  isAuthenticated: false,
  login: (user, token) =>
    set({
      user: user,
      role: user.role,
      token: token,
      isAuthenticated: true,
    }),

  logout: () => {
    localStorage.removeItem("token");
    set({
      user: null,
      role: null,
      token: null,
      isAuthenticated: false,
    });
  },
}));
