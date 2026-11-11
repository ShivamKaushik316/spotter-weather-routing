import type { BasemapName } from "@/shared/config/mapStyles";
import { cn } from "@/shared/lib/cn";
import { useThemeStore } from "@/shared/theme/themeStore";
import { LinkIcon, MoonIcon, SunIcon } from "@/shared/ui/icons";
import { Panel } from "@/shared/ui/Panel";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { showToast } from "@/shared/ui/toastStore";
import { useBasemapStore } from "@/stores/basemapStore";
import { useLayerStore, type MapLayerName } from "@/stores/layerStore";

const BASEMAP_OPTIONS: readonly { value: BasemapName; label: string }[] = [
  { value: "streets", label: "Map" },
  { value: "satellite", label: "Satellite" },
];

const LAYER_TOGGLES: readonly { layer: MapLayerName; label: string }[] = [
  { layer: "heatmap", label: "Heatmap" },
  { layer: "checkpoints", label: "Checkpoints" },
  { layer: "alternates", label: "Alternates" },
];

const TOOL_BUTTON_CLASSES =
  "flex h-[34px] items-center gap-2 rounded-[9px] border px-3 text-[13px] font-medium transition duration-150";

async function copyShareLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast({
      tone: "success",
      title: "Share link copied",
      description: "Anyone with the link sees this trip.",
    });
  } catch {
    showToast({
      tone: "error",
      title: "Could not copy the link",
      description: window.location.href,
    });
  }
}

export function MapToolbar() {
  const visibility = useLayerStore((state) => state.visibility);
  const toggleLayer = useLayerStore((state) => state.toggleLayer);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const basemap = useBasemapStore((state) => state.basemap);
  const setBasemap = useBasemapStore((state) => state.setBasemap);

  return (
    <Panel
      as="nav"
      aria-label="Map controls"
      className="toolbar absolute right-4 top-4 flex gap-2 p-1.5"
    >
      <SegmentedControl<BasemapName>
        ariaLabel="Basemap"
        options={BASEMAP_OPTIONS}
        value={basemap}
        onChange={setBasemap}
        className="w-[164px]"
      />
      <div aria-hidden="true" className="mx-0.5 my-1 w-px bg-line" />
      {LAYER_TOGGLES.map(({ layer, label }) => (
        <button
          key={layer}
          type="button"
          aria-pressed={visibility[layer]}
          onClick={() => toggleLayer(layer)}
          className={cn(
            TOOL_BUTTON_CLASSES,
            visibility[layer]
              ? "border-line bg-raised text-ink"
              : "border-transparent text-muted hover:bg-hover hover:text-ink",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-[7px] rounded-full",
              visibility[layer] ? "bg-accent" : "bg-line-strong",
            )}
          />
          {label}
        </button>
      ))}
      <div aria-hidden="true" className="mx-0.5 my-1 w-px bg-line" />
      <button
        type="button"
        onClick={() => void copyShareLink()}
        className={cn(
          TOOL_BUTTON_CLASSES,
          "border-transparent text-muted hover:bg-hover hover:text-ink",
        )}
      >
        <LinkIcon size={15} /> Share
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        className={cn(
          TOOL_BUTTON_CLASSES,
          "border-transparent text-muted hover:bg-hover hover:text-ink",
        )}
      >
        {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
      </button>
    </Panel>
  );
}
