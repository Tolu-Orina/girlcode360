import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import {
  DESKTOP_NAV_MORE,
  DESKTOP_NAV_PRIMARY,
  DESKTOP_TABS,
} from "@/components/blocks/nav-config";
import { useMediaQuery, useStandalone } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const navFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex min-h-[var(--tap)] items-center rounded-[var(--radius)] px-3 text-[length:var(--text-label)] font-normal text-muted-foreground no-underline transition-colors",
    navFocus,
    "hover:bg-primary/10 hover:text-primary",
    isActive && "bg-primary/10 font-semibold text-primary",
  );

export function AppHeader() {
  const homeTo = useStandalone() ? "/app" : "/";
  const wide = useMediaQuery("(min-width: 1280px)");
  const visible = wide ? DESKTOP_TABS : DESKTOP_NAV_PRIMARY;
  const overflow = wide ? [] : DESKTOP_NAV_MORE;

  return (
    <header className="glass-surface sticky top-0 z-20 flex min-h-[calc(var(--header-height)+env(safe-area-inset-top))] items-center justify-between gap-4 border-b px-4 pt-[env(safe-area-inset-top)] lg:px-6">
      <Link
        to={homeTo}
        className={cn(
          "brand-mark brand-lockup inline-flex min-h-[var(--tap)] items-center gap-2 rounded-[var(--radius)] text-[length:var(--text-sub)] text-primary no-underline",
          navFocus,
        )}
        aria-label="GirlCode360"
      >
        <img
          src="/logo.png"
          alt=""
          width={24}
          height={24}
          className="brand-lockup-mark size-6 object-cover"
          decoding="async"
        />
        GirlCode360
      </Link>
      <nav className="hidden items-center gap-2 lg:flex" aria-label="Primary">
        {visible.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={linkClass}>
            {t.label}
          </NavLink>
        ))}
        {overflow.length > 0 ? <MoreNav items={overflow} /> : null}
      </nav>
    </header>
  );
}

function MoreNav({ items }: { items: typeof DESKTOP_NAV_MORE }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const location = useLocation();
  const moreActive = items.some((t) =>
    t.end
      ? location.pathname === t.to
      : location.pathname === t.to || location.pathname.startsWith(`${t.to}/`),
  );

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "inline-flex min-h-[var(--tap)] min-w-[var(--tap)] items-center justify-center gap-2 rounded-[var(--radius)] px-3 text-[length:var(--text-label)] font-normal text-muted-foreground",
          navFocus,
          "hover:bg-primary/10 hover:text-primary",
          moreActive && "bg-primary/10 font-semibold text-primary",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
        More
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 min-w-[10rem] rounded-[var(--radius)] border border-border bg-popover p-1 shadow-[var(--shadow-modal)]"
        >
          {items.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              role="menuitem"
              className={({ isActive }) =>
                cn(
                  "flex min-h-[var(--tap)] items-center rounded-[var(--radius)] px-3 text-[length:var(--text-label)] text-muted-foreground no-underline",
                  navFocus,
                  isActive && "bg-primary/10 font-semibold text-primary",
                )
              }
              onClick={() => setOpen(false)}
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}
