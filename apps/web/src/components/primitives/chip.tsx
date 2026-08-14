import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Chip({
  pressed,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-[var(--tap)] items-center justify-center rounded-full border px-4 text-[length:var(--text-label)] font-semibold",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground",
        className,
      )}
      {...props}
    />
  );
}
