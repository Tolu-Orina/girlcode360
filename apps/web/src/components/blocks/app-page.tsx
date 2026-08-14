import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const leadClass =
  "m-0 text-[length:var(--text-body)] leading-normal text-muted-foreground";

export const outlinedCardClass =
  "rounded-[var(--radius)] border border-border bg-card p-4";

export const elevatedCardClass =
  "grid gap-4 rounded-[var(--radius-sheet)] bg-card p-4 shadow-[var(--shadow-2)] lg:gap-6 lg:p-6";

export const formStackClass = "grid gap-4";

export const listClass = "m-0 grid list-none gap-0 p-0";

export const listItemClass = "border-b border-border py-4 last:border-b-0";

export function AppPage({
  children,
  className,
  as: Tag = "section",
  ...props
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "main";
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        "mx-auto grid w-full max-w-[var(--page-max)] gap-6",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function PageSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-4 border-t border-border pt-6", className)}>
      {title ? (
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
