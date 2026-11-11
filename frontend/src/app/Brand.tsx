import { TrendIcon } from "@/shared/ui/icons";

export function Brand() {
  return (
    <header className="flex items-center gap-2.5 border-b border-line px-[18px] pb-3.5 pt-4">
      <div className="grid size-[30px] place-items-center rounded-[9px] bg-gradient-to-br from-accent to-indigo-500 text-white">
        <TrendIcon size={16} />
      </div>
      <div>
        <h1 className="text-[15px] font-bold tracking-tight">Night Dispatch</h1>
        <p className="text-xs text-muted">Weather-aware truck routing</p>
      </div>
    </header>
  );
}
