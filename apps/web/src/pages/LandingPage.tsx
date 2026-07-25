import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const modules = [
  {
    to: "/signup",
    title: "Track what's really happening",
    body: "Cycle, PCOS, pregnancy, and TTC tracking built around real symptoms — not generic charts that ignore what you're going through.",
  },
  {
    to: "/signup",
    title: "Your Health Wallet",
    body: "Labs, scripts, and scans encrypted on your device before they ever leave it. Share links you control, that expire on your terms.",
  },
  {
    to: "/signup",
    title: "Ask Alena",
    body: "A health companion that actually knows your data — your cycle, your history, your budget. Ask her anything, skip the search bar.",
  },
  {
    to: "/signup",
    title: "Find it near you",
    body: "SheMatch connects what's happening with your health right now to real pharmacies, clinics, and beauty pros close by — bookable, not just listed.",
  },
] as const;

const steps = [
  {
    n: "01",
    title: "Create your account",
    body: "Email sign-up, age gate, and market-aware consent in a few calm steps.",
  },
  {
    n: "02",
    title: "Choose your modules",
    body: "Cycle, PCOS, pregnancy, TTC, and Wallet — turn on only what you need.",
  },
  {
    n: "03",
    title: "Log and prepare",
    body: "Build a clear picture for yourself and your clinician, when you're ready.",
  },
] as const;

const privacyPoints = [
  {
    title: "Your consents, your call",
    body: "Turn analytics, Alena, and HealthLens on or off anytime in Account.",
  },
  {
    title: "Export or delete",
    body: "Download your data as JSON, or request deletion with a 24-hour cooling-off window.",
  },
  {
    title: "Wellness only",
    body: "We never diagnose. Patterns and Prep Cards help you talk to a clinician.",
  },
] as const;

const wrap = "mx-auto w-full max-w-[1180px] px-[clamp(1.25rem,4vw,2rem)]";

function BrandMark({
  className = "",
  size = 36,
  light = false,
}: {
  className?: string;
  size?: number;
  light?: boolean;
}) {
  return (
    <span className={cn("brand-lockup inline-flex items-center gap-2.5", className)}>
      <img
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        className="brand-lockup-mark shrink-0 rounded-[0.45rem] object-cover"
        decoding="async"
      />
      <span className={cn("brand-mark", light && "text-white")}>GirlCode360</span>
    </span>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/14 bg-primary/8 px-3.5 py-1.5 text-[0.78rem] font-bold tracking-[0.08em] text-[#6e0d3d] uppercase before:size-1.5 before:rounded-full before:bg-[#e24e93] before:content-['']">
      {children}
    </span>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-[#fffbfc] text-foreground">
      <header
        className={cn(
          "sticky top-0 z-20 border-b border-primary/14 bg-[#fffbfc]/85 backdrop-blur-[10px]",
          "animate-[fade-in_500ms_var(--ease-out)]",
          "pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3",
        )}
      >
        <div className={cn("relative flex h-[3.25rem] items-center justify-between gap-3", wrap)}>
          <Link
            to="/"
            className="relative z-10 min-w-0 shrink text-inherit no-underline"
            aria-label="GirlCode360 home"
          >
            <BrandMark size={32} className="text-[1.15rem] text-foreground" />
          </Link>

          <nav
            className="pointer-events-none absolute inset-x-0 hidden items-center justify-center gap-[clamp(1.5rem,3vw,2.25rem)] px-48 lg:flex"
            aria-label="Page sections"
          >
            {[
              ["#modules", "Features"],
              ["#how", "How it works"],
              ["#private", "Privacy"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="pointer-events-auto inline-flex min-h-[var(--tap)] items-center text-[0.95rem] font-semibold text-foreground/80 no-underline hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="relative z-10 flex shrink-0 items-center justify-end gap-2 sm:gap-4">
            <Button
              variant="ghost"
              className="hidden text-foreground lg:inline-flex"
              asChild
            >
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Create account</Link>
            </Button>
          </div>
        </div>

        <nav
          className={cn("mt-1 flex items-center gap-4 lg:hidden", wrap)}
          aria-label="Page sections"
        >
          {[
            ["#modules", "Features"],
            ["#how", "How it works"],
            ["#private", "Privacy"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="inline-flex min-h-[var(--tap)] items-center text-sm font-extrabold text-muted-foreground no-underline hover:text-primary"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      {/* Hero: full-bleed gradient, one composition — brand + USP + marketplace visual */}
      <section
        className="relative min-h-[calc(100dvh-5.5rem)] overflow-hidden bg-[radial-gradient(1100px_500px_at_85%_-10%,rgba(226,78,147,0.20),transparent_60%),linear-gradient(180deg,#f7e1ea_0%,#fff6f9_100%)] py-[clamp(3rem,8vw,5.5rem)]"
        aria-label="GirlCode360"
      >
        <div
          className={cn(
            "grid animate-[rise-in_700ms_var(--ease-out)] items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14",
            wrap,
          )}
        >
          <div className="grid max-w-[40rem] gap-4">
            <p className="brand-mark m-0 text-[clamp(1.85rem,4.5vw,2.75rem)] text-primary">
              GirlCode360
            </p>
            <Eyebrow>Not just tracking</Eyebrow>
            <h1 className="m-0 max-w-[14ch] font-[family-name:var(--font-display)] text-[clamp(2rem,4.4vw,3.35rem)] font-semibold tracking-tight text-foreground">
              Your cycle, your records, your city — in one app
            </h1>
            <p className="m-0 max-w-[44ch] text-[1.125rem] leading-relaxed text-[#4a3540]">
              Track your cycle, PCOS, pregnancy, and TTC journey with notes your
              doctor will actually use. Keep every health document in one secure
              vault. Then find and book real pharmacies, clinics, and beauty pros
              near you — no switching apps.
            </p>
            <p className="m-0 max-w-[46ch] text-[0.95rem] text-muted-foreground">
              No diagnosis theatre, no scattered records, no guessing who&apos;s
              nearby and open. Just your health, handled — end to end.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/signup">Start free</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/signin">I already have an account</Link>
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] font-bold tracking-wide text-[#6e0d3d]">
              {["Private by default", "On-device encryption", "You control every share"].map(
                (t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 before:size-1.5 before:rounded-full before:bg-[#e24e93] before:content-['']"
                  >
                    {t}
                  </span>
                ),
              )}
            </div>
          </div>

          <div
            className="relative mx-auto h-[min(420px,70vw)] w-full max-w-[28rem] lg:mx-0 lg:h-[520px] lg:max-w-none"
            aria-hidden="true"
          >
            <div className="absolute top-[6%] right-0 z-[1] w-[78%] rotate-[4deg] rounded-[1.35rem] border border-primary/14 bg-[#fffbfc] p-5 shadow-[0_20px_50px_-20px_rgba(110,13,61,0.35)] sm:p-6">
              <h3 className="m-0 font-[family-name:var(--font-display)] text-[1.05rem] font-semibold text-foreground">
                Near you
              </h3>
              <ul className="mt-3.5 m-0 grid list-none gap-2.5 p-0">
                {[
                  ["B", "Boots Pharmacy — 0.4mi", "Open now"],
                  ["C", "Cheveux Hair Studio — 0.8mi", "Books today"],
                  ["+", "6 more nearby", "Pharmacies · Clinics · Beauty"],
                ].map(([pin, title, sub]) => (
                  <li
                    key={title}
                    className="flex items-start gap-2.5 text-[0.8125rem] font-bold text-foreground"
                  >
                    <span className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-[#f2cfdf] text-[0.75rem] text-[#6e0d3d]">
                      {pin}
                    </span>
                    <span>
                      {title}
                      <small className="mt-0.5 block text-[0.72rem] font-medium text-muted-foreground">
                        {sub}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="absolute bottom-0 left-0 z-[2] w-[88%] animate-[floaty_7s_ease-in-out_infinite] rounded-[1.35rem] border border-primary/14 bg-[#fffbfc] px-5 pt-7 pb-6 shadow-[0_20px_50px_-20px_rgba(110,13,61,0.35)] sm:px-6 motion-reduce:animate-none">
              <h3 className="m-0 font-[family-name:var(--font-display)] text-[1.35rem] font-semibold text-foreground">
                Cycle
              </h3>
              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {Array.from({ length: 21 }, (_, i) => {
                  const day = i + 1;
                  const on = day >= 3 && day <= 5;
                  const peak = day === 14 || day === 15;
                  return (
                    <span
                      key={day}
                      className={cn(
                        "grid aspect-square place-items-center rounded-[9px] text-[0.8125rem] font-bold",
                        on && "bg-primary text-primary-foreground",
                        peak && "bg-[#e24e93] text-white",
                        !on && !peak && "bg-[#f7e1ea] text-foreground",
                      )}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>
              <p className="mt-3.5 m-0 text-[0.78rem] font-semibold text-muted-foreground">
                Next period window · private on-device · 6 pharmacies near you
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="modules"
        className={cn("scroll-mt-[4.5rem] py-[clamp(4.5rem,10vw,6.5rem)]", wrap)}
        aria-labelledby="modules-heading"
      >
        <div className="mb-12 grid max-w-[40rem] gap-3.5">
          <Eyebrow>Everything in one place</Eyebrow>
          <h2
            id="modules-heading"
            className="m-0 font-[family-name:var(--font-display)] text-[clamp(1.75rem,3.2vw,2.5rem)] font-semibold text-foreground"
          >
            Four tools that actually talk to each other
          </h2>
          <p className="m-0 text-[1.05rem] text-muted-foreground">
            Built as one private space, not four separate apps stitched together.
            Tap a card to start.
          </p>
        </div>

        <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map((m) => (
            <li key={m.title}>
              <Link
                to={m.to}
                className="flex h-full flex-col rounded-2xl border border-primary/14 bg-[#fff6f9] px-6 pt-7 pb-6 text-inherit no-underline transition hover:-translate-y-1 hover:border-transparent hover:shadow-[0_24px_40px_-26px_rgba(110,13,61,0.4)]"
              >
                <span
                  className="mb-5 grid size-[46px] grid-cols-2 gap-0.5 rounded-xl bg-[#f7e1ea] p-1.5"
                  aria-hidden="true"
                >
                  <i className="rounded-sm bg-primary opacity-100" />
                  <i className="rounded-sm bg-primary opacity-35" />
                  <i className="rounded-sm bg-primary opacity-70" />
                  <i className="rounded-sm bg-primary opacity-35" />
                </span>
                <strong className="mb-2.5 font-[family-name:var(--font-display)] text-[1.2rem] font-semibold text-foreground">
                  {m.title}
                </strong>
                <span className="flex-1 text-[0.9rem] leading-snug text-muted-foreground">
                  {m.body}
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[0.85rem] font-bold text-[#6e0d3d]">
                  Get started →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="bg-[linear-gradient(180deg,#fff6f9,#f7e1ea_80%)] py-[clamp(4.5rem,10vw,6.5rem)]"
        aria-labelledby="alena-heading"
      >
        <div
          className={cn(
            "grid items-center gap-10 lg:grid-cols-2 lg:gap-14",
            wrap,
          )}
        >
          <div className="grid gap-4">
            <Eyebrow>Meet Alena</Eyebrow>
            <h2
              id="alena-heading"
              className="m-0 max-w-[14ch] font-[family-name:var(--font-display)] text-[clamp(1.75rem,3.2vw,2.35rem)] font-semibold text-foreground"
            >
              The one part of your wellness stack that actually knows you
            </h2>
            <p className="m-0 max-w-[42ch] text-[1.05rem] text-muted-foreground">
              Alena isn&apos;t a search bar. She&apos;s read your cycle data, your
              vault, and what&apos;s actually open near you — so you get answers,
              not a list of links.
            </p>
            <p className="m-0 text-[0.85rem] font-bold text-[#6e0d3d]">
              Ask Alena anything. She already knows your cycle, your history, and
              your postcode.
            </p>
          </div>

          <div
            className="rounded-[1.25rem] border border-primary/14 bg-[#fffbfc] p-6 shadow-[0_20px_50px_-20px_rgba(110,13,61,0.35)]"
            aria-hidden="true"
          >
            <div className="mb-4 flex items-center gap-2.5 border-b border-primary/14 pb-4 text-sm font-bold">
              <span className="size-[30px] rounded-[9px] bg-[linear-gradient(135deg,#e24e93,#a6115c)]" />
              Alena
            </div>
            <div className="grid gap-3">
              <p className="ml-auto mb-0 max-w-[82%] rounded-[14px] rounded-br-sm bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
                What skincare can I get with £20?
              </p>
              <p className="mb-0 max-w-[82%] rounded-[14px] rounded-bl-sm bg-[#f7e1ea] px-4 py-3 text-sm font-semibold text-foreground">
                A gentle cleanser and a niacinamide serum from Boots, both in
                stock 0.4mi away.
                <small className="mt-1 block text-xs font-medium text-muted-foreground">
                  Based on your logged skin concerns
                </small>
              </p>
              <p className="ml-auto mb-0 max-w-[82%] rounded-[14px] rounded-br-sm bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
                When am I ovulating?
              </p>
              <p className="mb-0 max-w-[82%] rounded-[14px] rounded-bl-sm bg-[#f7e1ea] px-4 py-3 text-sm font-semibold text-foreground">
                Your fertile window opens in 3 days, peaking around day 14.
                <small className="mt-1 block text-xs font-medium text-muted-foreground">
                  No calendar-checking needed
                </small>
              </p>
              <p className="ml-auto mb-0 max-w-[82%] rounded-[14px] rounded-br-sm bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
                Where&apos;s the closest Boots to me?
              </p>
              <p className="mb-0 max-w-[82%] rounded-[14px] rounded-bl-sm bg-[#f7e1ea] px-4 py-3 text-sm font-semibold text-foreground">
                0.4 miles away on Deansgate — open until 8pm today.
                <small className="mt-1 block text-xs font-medium text-muted-foreground">
                  Live from SheMatch
                </small>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how"
        className={cn(
          "scroll-mt-[4.5rem] bg-[#fffbfc] py-[clamp(4.5rem,10vw,6.5rem)]",
          wrap,
        )}
        aria-labelledby="steps-heading"
      >
        <div className="mb-10 grid max-w-[40rem] gap-3.5">
          <Eyebrow>How it works</Eyebrow>
          <h2
            id="steps-heading"
            className="m-0 font-[family-name:var(--font-display)] text-[clamp(1.75rem,3.2vw,2.5rem)] font-semibold text-foreground"
          >
            Three short steps to a private wellness space
          </h2>
          <p className="m-0 text-[1.05rem] text-muted-foreground">
            Order matters here — each step unlocks the next.
          </p>
        </div>

        <ol className="m-0 grid list-none gap-8 p-0 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <li key={s.n} className="border-t-2 border-primary/14 pt-5">
              <span className="mb-3.5 block font-[family-name:var(--font-display)] text-[0.95rem] font-semibold text-[#e24e93]">
                {s.n}
              </span>
              <strong className="mb-2.5 block font-[family-name:var(--font-display)] text-[1.2rem] font-semibold text-foreground">
                {s.title}
              </strong>
              <p className="m-0 text-[0.9rem] leading-snug text-muted-foreground">
                {s.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <Button asChild>
            <Link to="/signup">Create your account</Link>
          </Button>
        </div>
      </section>

      <section
        id="private"
        className="scroll-mt-[4.5rem] bg-[linear-gradient(180deg,#f7e1ea_0%,#f2cfdf_100%)] py-[clamp(4.5rem,10vw,6.5rem)]"
        aria-labelledby="privacy-heading"
      >
        <div className={wrap}>
          <div className="mb-8 grid max-w-[40rem] gap-3.5">
            <Eyebrow>Private by design</Eyebrow>
            <h2
              id="privacy-heading"
              className="m-0 font-[family-name:var(--font-display)] text-[clamp(1.75rem,3.2vw,2.5rem)] font-semibold text-foreground"
            >
              Built to earn your trust, everywhere
            </h2>
            <p className="m-0 text-[1.05rem] text-muted-foreground">
              With consent you control, and no health content in notification
              bodies.
            </p>
          </div>

          <ul className="m-0 grid list-none gap-8 p-0 md:grid-cols-3">
            {privacyPoints.map((p) => (
              <li key={p.title} className="grid gap-2.5">
                <strong className="font-[family-name:var(--font-display)] text-[1.05rem] font-semibold text-foreground">
                  {p.title}
                </strong>
                <span className="text-[0.9rem] leading-snug text-[#5a4550]">
                  {p.body}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/signup">Start free</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/privacy">Read privacy</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="bg-foreground py-11 text-[#f3e4ec]">
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-4 pb-[env(safe-area-inset-bottom)]",
            wrap,
          )}
        >
          <BrandMark size={28} className="text-[1.1rem]" light />
          <nav className="flex flex-wrap gap-6" aria-label="Legal">
            {[
              ["/privacy", "Privacy"],
              ["/terms", "Terms"],
              ["/signin", "Sign in"],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className="inline-flex min-h-[var(--tap)] items-center text-sm font-semibold text-[#e7c7d6] no-underline hover:text-white"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>

      <style>{`
        @keyframes floaty {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
