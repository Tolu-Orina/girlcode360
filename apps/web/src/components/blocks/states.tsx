import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-4 py-8 text-center">
      <h2 className="m-0 text-[length:var(--text-sub)] font-semibold text-foreground">
        {title}
      </h2>
      {body ? (
        <p className="m-0 max-w-md text-[length:var(--text-body)] text-muted-foreground">
          {body}
        </p>
      ) : null}
      {action}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] border border-destructive/30 bg-card p-4"
      role="alert"
    >
      <p className="m-0 text-[length:var(--text-body)] text-destructive">
        {message}
      </p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function OfflineBanner({
  message = "You are offline. Cycle logging still works on this device. Mirror, Alena, and Wallet need a connection.",
}: {
  message?: string;
}) {
  return (
    <p
      className="m-0 rounded-[var(--radius)] border border-border bg-muted px-4 py-3 text-[length:var(--text-label)] text-foreground"
      role="status"
    >
      {message}
    </p>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <p
      className="m-0 rounded-[var(--radius)] border border-ok/30 bg-card px-4 py-3 text-[length:var(--text-label)] text-ok"
      role="status"
    >
      {message}
    </p>
  );
}

export function SkeletonBlock({
  className = "h-12",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius)] bg-muted ${className}`}
      aria-hidden="true"
    />
  );
}
