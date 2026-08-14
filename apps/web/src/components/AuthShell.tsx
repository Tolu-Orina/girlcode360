import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AmbientLayer } from "@/components/blocks/ambient-layer";
import { cn } from "@/lib/utils";

export function AuthAlert({ children }: { children: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [children]);
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="m-0 text-[length:var(--text-label)] text-destructive outline-none"
    >
      {children}
    </p>
  );
}

export function AuthShell({
  title,
  lead,
  children,
  footer,
  panelImage = "/images/auth-panel-welcome.png",
  panelAlt = "",
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  footer?: ReactNode;
  panelImage?: string;
  panelAlt?: string;
}) {
  return (
    <main className="relative grid min-h-dvh bg-background lg:grid-cols-2">
      <AmbientLayer />
      <aside
        className="relative z-10 hidden overflow-hidden lg:block"
        aria-hidden={panelAlt ? undefined : true}
      >
        <img
          src={panelImage}
          alt={panelAlt}
          className="absolute inset-0 size-full object-cover object-center"
          decoding="async"
        />
      </aside>
      <div
        className={cn(
          "relative z-10 mx-auto flex w-full max-w-[var(--auth-max)] flex-col justify-center",
          "px-4 pb-[calc(var(--space-6)+env(safe-area-inset-bottom))] pt-[calc(var(--space-6)+env(safe-area-inset-top))]",
          "lg:mx-0 lg:ml-[clamp(2rem,8vw,6rem)] lg:max-w-[440px] lg:py-12",
        )}
      >
        <div className="glass-surface grid gap-4 rounded-[var(--radius-sheet)] border p-6">
          <Link
            to="/"
            className="brand-lockup brand-mark inline-flex min-h-[var(--tap)] items-center gap-2 rounded-[var(--radius)] text-[length:var(--text-section)] text-primary no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              className="brand-lockup-mark size-10 rounded-[var(--radius)] object-cover"
              decoding="async"
            />
            GirlCode360
          </Link>
          <h1 className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-section)] text-foreground">
            {title}
          </h1>
          {lead ? (
            <p className="m-0 text-[length:var(--text-body)] text-muted-foreground">
              {lead}
            </p>
          ) : null}
          {children}
          {footer}
        </div>
      </div>
    </main>
  );
}