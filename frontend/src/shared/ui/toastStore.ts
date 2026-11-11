import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastState {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
}

const TOAST_LIFETIME_MILLISECONDS = 3200;
const MAXIMUM_VISIBLE_TOASTS = 3;
let nextToastId = 1;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  showToast: (toast) => {
    const id = nextToastId++;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }].slice(-MAXIMUM_VISIBLE_TOASTS),
    }));
    window.setTimeout(() => get().dismissToast(id), TOAST_LIFETIME_MILLISECONDS);
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const showToast = (toast: Omit<Toast, "id">) => useToastStore.getState().showToast(toast);
