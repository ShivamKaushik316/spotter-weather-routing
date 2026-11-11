import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BasemapName } from "@/shared/config/mapStyles";
import { createSafeLocalStorage } from "@/shared/lib/safeStorage";

interface BasemapState {
  basemap: BasemapName;
  setBasemap: (basemap: BasemapName) => void;
}

const BASEMAP_STORAGE_KEY = "night-dispatch-basemap";

export const useBasemapStore = create<BasemapState>()(
  persist(
    (set) => ({
      basemap: "streets",
      setBasemap: (basemap) => set({ basemap }),
    }),
    {
      name: BASEMAP_STORAGE_KEY,
      storage: createSafeLocalStorage<Pick<BasemapState, "basemap">>(),
      partialize: (state) => ({ basemap: state.basemap }),
    },
  ),
);
