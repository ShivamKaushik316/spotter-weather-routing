import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/shared/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink font-bold hover:brightness-110",
  secondary: "border border-accent bg-accent-soft text-accent font-semibold hover:brightness-110",
  ghost: "text-muted hover:bg-hover hover:text-ink font-medium",
};

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

export function Button({
  variant = "primary",
  isLoading = false,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-control px-3 py-2.5 text-sm transition duration-150 ease-out active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASSES[variant],
        isLoading && "shimmer",
        className,
      )}
      disabled={disabled ?? isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {children}
    </button>
  );
}
