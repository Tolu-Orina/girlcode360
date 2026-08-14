import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label
        htmlFor={id}
        className="text-[length:var(--text-label)] font-medium text-foreground"
      >
        {label}
      </Label>
      {children}
      {hint && !error ? (
        <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="m-0 text-[length:var(--text-caption)] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FieldInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        "h-12 min-h-[var(--tap)] bg-card text-[length:var(--text-body)] shadow-none md:text-[length:var(--text-body)]",
        className,
      )}
      {...props}
    />
  );
}

export function FieldSelect({
  className,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-12 min-h-[var(--tap)] w-full rounded-md border border-input bg-card px-3 text-[length:var(--text-body)] outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

export function FieldTextarea({
  className,
  ...props
}: ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      className={cn(
        "min-h-24 bg-card text-[length:var(--text-body)] shadow-none md:text-[length:var(--text-body)]",
        className,
      )}
      {...props}
    />
  );
}
