import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

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
    <main className="grid min-h-dvh bg-[radial-gradient(800px_420px_at_0%_0%,#f0c4db_0%,transparent_55%),linear-gradient(160deg,#fbf4f7_0%,#f3e4ed_100%)] lg:grid-cols-2">
      {/* Left brand panel */}
      <aside
        className="relative hidden overflow-hidden lg:block"
        aria-hidden={panelAlt ? undefined : true}
      >
        <img
          src={panelImage}
          alt={panelAlt}
          className="absolute inset-0 size-full object-cover object-center"
          decoding="async"
        />
      </aside>

      {/* Right form column */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-[var(--auth-max)] flex-col justify-center gap-4",
          "px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))]",
          "animate-[rise-in_500ms_var(--ease-out)] lg:mx-0 lg:ml-[clamp(2rem,8vw,6rem)] lg:max-w-[440px] lg:py-12",
        )}
      >
        <Link
          to="/"
          className="brand-lockup brand-mark inline-flex items-center gap-2.5 text-[clamp(1.85rem,5vw,2.35rem)] text-primary no-underline"
        >
          <img
            src="/logo.png"
            alt=""
            width={40}
            height={40}
            className="brand-lockup-mark size-10 rounded-lg object-cover"
            decoding="async"
          />
          GirlCode360
        </Link>
        <h1 className="font-sans text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {lead ? <p className="-mt-1 text-muted-foreground">{lead}</p> : null}
        {children}
        {footer}
      </div>
    </main>
  );
}
