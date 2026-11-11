import { createJSONStorage, type PersistStorage } from "zustand/middleware";

export function createSafeLocalStorage<State>(): PersistStorage<State> | undefined {
  return createJSONStorage<State>(() => ({
    getItem: (name) => {
      try {
        return window.localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        window.localStorage.setItem(name, value);
      } catch {
        return;
      }
    },
    removeItem: (name) => {
      try {
        window.localStorage.removeItem(name);
      } catch {
        return;
      }
    },
  }));
}
