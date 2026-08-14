import type { ComponentProps, ReactNode } from "react";
import { FieldInput } from "@/components/primitives/field";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function PasswordField({
  id,
  label,
  hint,
  extra,
  value,
  onChange,
  autoComplete,
  show,
  onToggleShow,
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
  extra?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  autoComplete: ComponentProps<"input">["autoComplete"];
  show: boolean;
  onToggleShow: () => void;
} & Omit<ComponentProps<typeof FieldInput>, "id" | "value" | "onChange" | "type" | "autoComplete">) {
  return (
    <div className="grid gap-2">
      <div
        className={cn(
          "flex items-center justify-between gap-4",
          extra && "min-h-[var(--tap)]",
        )}
      >
        <Label
          htmlFor={id}
          className="text-[length:var(--text-label)] font-medium text-foreground"
        >
          {label}
        </Label>
        {extra}
      </div>
      <div className="relative">
        <FieldInput
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          className="pr-20"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
        <button
          type="button"
          className="absolute top-0 right-1 inline-flex min-h-[var(--tap)] items-center px-3 text-[length:var(--text-label)] font-semibold text-primary"
          onClick={onToggleShow}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? (
        <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AuthOfflineNote({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <p
      className="m-0 text-[length:var(--text-label)] text-foreground"
      role="status"
    >
      You are offline. Connect, then try again.
    </p>
  );
}