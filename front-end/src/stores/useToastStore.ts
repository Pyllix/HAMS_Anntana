import { create } from "zustand";

export type ToastType = "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string) => void;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
