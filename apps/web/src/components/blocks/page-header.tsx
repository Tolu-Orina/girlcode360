import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <header className="grid min-w-0 gap-2">
      {eyebrow ? (
        <p className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-caption)] font-bold tracking-wide text-primary uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="m-0 text-[length:var(--text-page)] text-primary max-lg:text-[28px]">
        {title}
      </h1>
      {lead ? (
        <p className="m-0 text-[length:var(--text-body)] leading-normal text-muted-foreground">
          {lead}
        </p>
      ) : null}
    </header>
  );
}
