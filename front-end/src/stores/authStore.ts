import { create } from "zustand";
import { User, UserRole } from "../types/TypeUser";

interface AuthState {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  login: (user) =>
    set({
      user: user,
      role: user.role,
      isAuthenticated: true,
    })
    
    ,
  logout: () =>
    set({
      user: null,
      role: null,
      isAuthenticated: false,
    }),
}));
