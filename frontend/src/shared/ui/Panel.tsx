import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/shared/lib/cn";

type PanelElement = "div" | "aside" | "section" | "nav" | "footer";

interface PanelProps extends ComponentPropsWithoutRef<"div"> {
  as?: PanelElement;
}

export function Panel({ as: Element = "div", className, ...props }: PanelProps) {
  return <Element className={cn("glass", className)} {...props} />;
}
