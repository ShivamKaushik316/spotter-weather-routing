import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface SectionLabelProps {
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
  id?: string;
}

export function SectionLabel({ children, trailing, className, id }: SectionLabelProps) {
  return (
    <div
      className={cn(
        "mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[.08em] text-muted",
        className,
      )}
    >
      <span id={id}>{children}</span>
      {trailing}
    </div>
  );
}
