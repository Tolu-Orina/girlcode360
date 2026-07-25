import { Link, NavLink, Outlet } from "react-router-dom";
import { InstallPrompt } from "@/components/InstallPrompt";
import { cn } from "@/lib/utils";

const tabs: {
  to: string;
  label: string;
  end?: boolean;
  icon: string;
}[] = [
  { to: "/app", label: "Home", end: true, icon: "M3 10.5 12 3l9 7.5V21H14V14H10v7H3z" },
  {
    to: "/app/cycle",
    label: "Cycle",
    icon: "M12 4a8 8 0 1 1-7.5 5.2M12 4V2m0 2 2.2 1.6",
  },
  {
    to: "/app/health",
    label: "Health",
    icon: "M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.6-7 10-7 10z",
  },
  {
    to: "/app/alena",
    label: "Alena",
    icon: "M21 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z",
  },
  {
    to: "/app/account",
    label: "Account",
    icon: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z",
  },
];

function TabIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex min-h-[var(--tap)] items-center rounded-md px-3.5 text-[0.95rem] font-medium text-muted-foreground no-underline transition",
    "hover:bg-primary/6 hover:text-primary",
    isActive && "bg-primary/10 font-bold text-primary",
  );

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "grid min-h-[52px] content-center justify-items-center gap-0.5 rounded-md px-0.5 py-1.5 text-[0.68rem] font-semibold tracking-wide text-muted-foreground no-underline transition",
    isActive && "text-primary",
  );

export function AppShell() {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr_auto] bg-[radial-gradient(900px_420px_at_100%_-20%,#f3d0e4_0%,transparent_55%),var(--surface-soft)] text-foreground">
      <InstallPrompt />
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-white/82 px-[clamp(1rem,3vw,1.5rem)] py-3.5 backdrop-blur-[10px]">
        <Link
          to="/"
          className="brand-mark brand-lockup inline-flex items-center gap-2 text-[1.2rem] text-primary no-underline"
          aria-label="GirlCode360"
        >
          <img
            src="/logo.png"
            alt=""
            width={28}
            height={28}
            className="brand-lockup-mark size-7 rounded object-cover"
            decoding="async"
          />
          GirlCode360
        </Link>
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={desktopLinkClass}>
              {t.label}
            </NavLink>
          ))}
          <NavLink to="/app/library" className={desktopLinkClass}>
            Library
          </NavLink>
        </nav>
      </header>

      <main
        className="mx-auto w-full max-w-[var(--shell-max)] animate-[fade-in_350ms_var(--ease-out)] px-[clamp(1rem,3vw,2rem)] py-6 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-8"
        id="main-content"
      >
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 gap-0.5 border-t border-border bg-white/94 px-1 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))] backdrop-blur-[12px] lg:hidden"
        aria-label="Mobile primary"
      >
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={mobileLinkClass}>
            <TabIcon d={t.icon} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
