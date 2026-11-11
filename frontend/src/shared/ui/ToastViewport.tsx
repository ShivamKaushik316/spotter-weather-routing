import { cn } from "@/shared/lib/cn";
import { AlertIcon, CloseIcon, InfoIcon } from "./icons";
import { useToastStore, type ToastTone } from "./toastStore";

const TONE_CLASSES: Record<ToastTone, string> = {
  info: "text-accent",
  success: "text-risk-low",
  error: "text-risk-severe",
};

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-[148px] left-1/2 z-50 flex w-[min(420px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
          className="glass toast-enter pointer-events-auto flex items-start gap-3 px-3.5 py-3 text-sm"
        >
          <span className={cn("mt-0.5", TONE_CLASSES[toast.tone])}>
            {toast.tone === "error" ? <AlertIcon size={15} /> : <InfoIcon size={15} />}
          </span>
          <div className="flex-1">
            <div className="font-semibold">{toast.title}</div>
            {toast.description && (
              <div className="mt-0.5 text-xs text-muted">{toast.description}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="text-muted hover:text-ink"
            aria-label="Dismiss notification"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
