import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/shared/lib/cn";

interface ChipProps extends ComponentPropsWithoutRef<"button"> {
  isActive?: boolean;
}

export function Chip({ isActive = false, className, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={isActive}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition duration-150",
        isActive
          ? "border-accent bg-accent-soft text-accent"
          : "border-line bg-raised text-muted hover:border-line-strong hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}
