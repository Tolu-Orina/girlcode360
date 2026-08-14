import { useEffect, useId, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShineSweep } from "@/components/blocks/motion-glow";
import { marketingChromePad } from "@/components/blocks/marketing-layout";
import { cn } from "@/lib/utils";

const navFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const navLink =
  "relative inline-flex h-9 items-center rounded-[var(--radius)] px-1 text-[length:var(--text-label)] font-semibold text-muted-foreground no-underline hover:text-foreground";

const easeOut = [0.22, 1, 0.36, 1] as const;

function BrandMark({
  className = "",
  light = false,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    <span className={cn("brand-lockup inline-flex items-center gap-2", className)}>
      <img
        src="/logo.png"
        alt=""
        width={32}
        height={32}
        className="brand-lockup-mark size-8 shrink-0 rounded-[var(--radius)] object-cover"
        decoding="async"
      />
      <span className={cn("brand-mark", light && "!text-primary-foreground")}>GirlCode360</span>
    </span>
  );
}

const LANDING_LINKS = [
  ["/#ecosystem", "Ecosystem", "ecosystem"],
  ["/#how", "How it works", "how"],
  ["/#mirror", "Mirror", "mirror"],
  ["/privacy", "Privacy", "privacy"],
] as const;

function useLandingSection() {
  const { pathname, hash } = useLocation();
  const [section, setSection] = useState("ecosystem");

  useEffect(() => {
    if (pathname !== "/") return;
    const fromHash = hash.replace("#", "");
    if (fromHash) setSection(fromHash);

    const ids = ["ecosystem", "how", "mirror"];
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!nodes.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setSection(visible.target.id);
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: [0.2, 0.5] },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [pathname, hash]);

  if (pathname === "/privacy") return "privacy";
  return section;
}

function scrollToLandingId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.pushState(null, "", `/#${id}`);
}

function NavItem({
  href,
  label,
  active,
  reduce,
  inkId,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  reduce: boolean | null;
  inkId: string;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const hashId = href.startsWith("/#") ? href.slice(2) : null;

  function ink() {
    if (active && !reduce) {
      return (
        <motion.span
          layoutId={inkId}
          className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-primary"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      );
    }
    if (active) {
      return <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-primary" />;
    }
    return null;
  }

  if (hashId && pathname === "/") {
    return (
      <a
        href={`#${hashId}`}
        className={cn(navLink, navFocus, active && "text-foreground")}
        onClick={(e) => {
          e.preventDefault();
          scrollToLandingId(hashId);
          onNavigate?.();
        }}
      >
        {label}
        {ink()}
      </a>
    );
  }

  return (
    <Link
      to={href}
      className={cn(navLink, navFocus, active && "text-foreground")}
      onClick={onNavigate}
    >
      {label}
      {ink()}
    </Link>
  );
}

export function MarketingHeader() {
  const reduce = useReducedMotion();
  const section = useLandingSection();
  const { pathname, hash } = useLocation();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const overlay = reduce
    ? {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.15 } },
      }
    : {
        hidden: { clipPath: "circle(0% at calc(100% - 40px) 36px)" },
        show: {
          clipPath: "circle(160% at calc(100% - 40px) 36px)",
          transition: { duration: 0.55, ease: easeOut },
        },
        exit: {
          clipPath: "circle(0% at calc(100% - 40px) 36px)",
          transition: { duration: 0.4, ease: easeOut },
        },
      };

  const list = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.08, delayChildren: reduce ? 0 : 0.12 },
    },
  };

  const item = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 28, rotate: -4 },
    show: {
      opacity: 1,
      y: 0,
      rotate: 0,
      transition: { type: "spring" as const, stiffness: 320, damping: 24 },
    },
  };

  return (
    <>
    <header
      className={cn(
        "glass-surface sticky top-0 z-20 border-b-0 pt-[env(safe-area-inset-top)]",
        open && "z-50",
      )}
    >
      <div
        className={cn(
          "flex h-[72px] items-center justify-between gap-4",
          marketingChromePad,
        )}
      >
        <Link
          to="/"
          className={cn("min-w-0 rounded-[var(--radius)] text-inherit no-underline", navFocus)}
          aria-label="GirlCode360 home"
        >
          <BrandMark className="text-[length:var(--text-sub)] text-foreground" />
        </Link>
        <LayoutGroup>
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
            {LANDING_LINKS.map(([href, label, id]) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                active={section === id}
                reduce={reduce}
                inkId="nav-ink-desktop"
              />
            ))}
          </nav>
        </LayoutGroup>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link
            to="/signin"
            className={cn(
              "hidden h-10 min-h-10 items-center text-[length:var(--text-label)] font-semibold text-foreground no-underline lg:inline-flex [@media(hover:hover)]:hover:text-primary",
              navFocus,
              "rounded-[var(--radius)]",
            )}
          >
            Sign in
          </Link>
          <Button
            asChild
            size="sm"
            className="relative hidden overflow-hidden rounded-full px-4 active:scale-[0.97] lg:inline-flex"
          >
            <Link to="/signup">
              Create account
              <ShineSweep />
            </Link>
          </Button>
          <button
            type="button"
            className={cn(
              "grid size-12 place-items-center rounded-[var(--radius)] text-foreground lg:hidden",
              navFocus,
            )}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? "close" : "open"}
                initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                className="grid place-items-center"
              >
                {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </header>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="fixed inset-0 z-40 bg-background lg:hidden"
            variants={overlay}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div
              className={cn(
                "flex h-full flex-col justify-center gap-8 overflow-y-auto pt-[calc(72px+env(safe-area-inset-top))] pb-8",
                marketingChromePad,
              )}
            >
              <motion.nav
                aria-label="Primary"
                className="flex flex-col gap-2"
                variants={list}
                initial="hidden"
                animate="show"
              >
                {LANDING_LINKS.map(([href, label, id]) => {
                  const active = section === id;
                  const hashId = href.startsWith("/#") ? href.slice(2) : null;
                  return (
                    <motion.div key={href} variants={item}>
                      {hashId ? (
                        <a
                          href={`#${hashId}`}
                          className={cn(
                            "inline-flex min-h-12 items-center font-[family-name:var(--font-display)] text-[length:var(--text-page)] font-semibold no-underline",
                            navFocus,
                            "rounded-[var(--radius)]",
                            active ? "text-primary" : "text-foreground",
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            setOpen(false);
                            window.setTimeout(() => scrollToLandingId(hashId), 50);
                          }}
                        >
                          {label}
                        </a>
                      ) : (
                        <Link
                          to={href}
                          className={cn(
                            "inline-flex min-h-12 items-center font-[family-name:var(--font-display)] text-[length:var(--text-page)] font-semibold no-underline",
                            navFocus,
                            "rounded-[var(--radius)]",
                            active ? "text-primary" : "text-foreground",
                          )}
                          onClick={() => setOpen(false)}
                        >
                          {label}
                        </Link>
                      )}
                    </motion.div>
                  );
                })}
              </motion.nav>
              <div className="flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]">
                <Button asChild className="h-12 min-h-[var(--tap)] rounded-full">
                  <Link to="/signup" onClick={() => setOpen(false)}>
                    Create account
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-12 min-h-[var(--tap)] rounded-full">
                  <Link to="/signin" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-foreground py-8 text-primary-foreground">
      <div
        className={cn(
          "grid gap-6 pb-[env(safe-area-inset-bottom)]",
          marketingChromePad,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BrandMark className="text-[length:var(--text-body)]" light />
          <nav className="flex flex-wrap gap-8" aria-label="Legal">
            {[
              ["/privacy", "Privacy"],
              ["/terms", "Terms"],
              ["/business", "Business"],
              ["/signin", "Sign in"],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "inline-flex h-10 min-h-10 items-center text-[length:var(--text-label)] font-semibold text-primary-foreground/80 no-underline [@media(hover:hover)]:hover:text-primary-foreground",
                  navFocus,
                  "rounded-[var(--radius)]",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-caption)] text-primary-foreground/70">
          <span>© 2026 GirlCode360</span>
          <span aria-hidden="true">·</span>
          <span>Built by Rinegan Solutions Limited</span>
        </p>
      </div>
    </footer>
  );
}
