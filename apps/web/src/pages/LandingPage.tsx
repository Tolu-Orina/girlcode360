import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    to: "/signup",
    title: "Mobile menus, not hamburger",
    body: "Thumb-zone tabs for Home, Cycle, Health, Zara, and Account — Add to Home Screen ready.",
    image: "/images/card-mobile.png",
    imageAlt:
      "Person using GirlCode360 cycle calendar on a phone in soft natural light",
  },
  {
    to: "/signup",
    title: "Encrypted Health Wallet",
    body: "Labs and scripts are encrypted on your device before they leave. Share links expire on your terms.",
    image: "/images/card-wallet.png",
    imageAlt:
      "Private health documents and phone suggesting a secure Health Wallet",
  },
  {
    to: "/signup",
    title: "Zara + HealthLens",
    body: "Wellness guidance and clinician Prep Cards — never a diagnosis, always yours to review.",
    image: "/images/card-zara.png",
    imageAlt:
      "Quiet morning journaling with phone nearby for wellness reflection",
  },
] as const;

const steps = [
  {
    n: "1",
    title: "Create your account",
    body: "Email sign-up, age gate, and market-aware consent in a few calm steps.",
  },
  {
    n: "2",
    title: "Choose your modules",
    body: "Period, PCOS, pregnancy, TTC, and Wallet — turn on only what you need.",
  },
  {
    n: "3",
    title: "Log and prepare",
    body: "Build a clear picture for yourself and your clinician when you are ready.",
  },
] as const;

const gutter = "px-[clamp(1rem,2.2vw,1.5rem)]";

function BrandMark({
  className = "",
  size = 36,
}: {
  className?: string;
  size?: number;
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
      <span className="brand-mark">GirlCode360</span>
    </span>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-card text-foreground">
      <header
        className={cn(
          "sticky top-0 z-20 border-b border-border bg-surface-soft",
          "animate-[fade-in_500ms_var(--ease-out)]",
          "pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3",
          gutter,
        )}
      >
        <div className="relative flex items-center justify-between gap-3">
          <Link
            to="/"
            className="relative z-10 min-w-0 shrink text-inherit no-underline"
            aria-label="GirlCode360 home"
          >
            <BrandMark size={32} className="text-[1.15rem] text-primary" />
          </Link>

          <nav
            className="pointer-events-none absolute inset-x-0 hidden items-center justify-center gap-[clamp(1rem,2.5vw,2rem)] px-48 lg:flex"
            aria-label="Page sections"
          >
            <a
              href="#features"
              className="pointer-events-auto inline-flex min-h-[var(--tap)] items-center text-[0.95rem] font-extrabold text-muted-foreground no-underline hover:text-primary"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="pointer-events-auto inline-flex min-h-[var(--tap)] items-center text-[0.95rem] font-extrabold text-muted-foreground no-underline hover:text-primary"
            >
              How it works
            </a>
            <a
              href="#privacy"
              className="pointer-events-auto inline-flex min-h-[var(--tap)] items-center text-[0.95rem] font-extrabold text-muted-foreground no-underline hover:text-primary"
            >
              Privacy
            </a>
          </nav>

          <div className="relative z-10 flex shrink-0 items-center justify-end gap-2">
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
          className="mt-1 flex items-center gap-4 lg:hidden"
          aria-label="Page sections"
        >
          <a
            href="#features"
            className="inline-flex min-h-[var(--tap)] items-center text-sm font-extrabold text-muted-foreground no-underline hover:text-primary"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="inline-flex min-h-[var(--tap)] items-center text-sm font-extrabold text-muted-foreground no-underline hover:text-primary"
          >
            How it works
          </a>
          <a
            href="#privacy"
            className="inline-flex min-h-[var(--tap)] items-center text-sm font-extrabold text-muted-foreground no-underline hover:text-primary"
          >
            Privacy
          </a>
        </nav>
      </header>

      <section
        className="relative overflow-hidden bg-[radial-gradient(900px_520px_at_12%_0%,#f3c4db_0%,transparent_55%),radial-gradient(800px_480px_at_92%_30%,#e8b4d4_0%,transparent_52%),linear-gradient(160deg,#fbf0f6_0%,#f5e0ec_50%,#ecd0e2_100%)] py-[clamp(1.5rem,3.5vw,2.5rem)] pb-[clamp(1.75rem,4vw,2.75rem)]"
        aria-label="GirlCode360"
      >
        <div
          className={cn(
            "grid animate-[rise-in_700ms_var(--ease-out)] items-center gap-6 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-[clamp(1.25rem,3vw,2.5rem)] lg:pt-7",
            gutter,
          )}
        >
          <div className="grid max-w-[34rem] gap-3 lg:pr-2">
            <p className="brand-mark m-0 text-[clamp(2rem,5vw,3.25rem)] text-primary">
              GirlCode360
            </p>
            <h1 className="m-0 max-w-[26ch] font-sans text-[clamp(1.2rem,2.4vw,1.55rem)] font-semibold tracking-tight text-foreground">
              Your private wellness space, made for real life
            </h1>
            <p className="m-0 max-w-[38ch] text-[1.05rem] text-muted-foreground">
              Track cycles, PCOS, pregnancy, and TTC — with clinician-ready notes
              and no diagnosis theatre.
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/signup">Start free</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/signin">I already have an account</Link>
              </Button>
            </div>
          </div>
          <div className="grid items-center justify-items-center lg:justify-items-end">
            <img
              className="block h-auto w-full max-w-[440px] rounded-xl object-cover shadow-[var(--shadow-soft)] lg:max-w-[580px] lg:w-[min(100%,580px)]"
              src="/images/hero-cycle.png"
              alt="GirlCode360 Cycle calendar showing logged period days and next window"
              width={1200}
              height={900}
              decoding="async"
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      <section
        id="features"
        className={cn(
          "scroll-mt-[4.5rem] grid gap-6 border-y border-border bg-surface-soft py-12",
          gutter,
        )}
        aria-labelledby="features-heading"
      >
        <div className="grid max-w-[40rem] gap-3">
          <h2 id="features-heading" className="m-0 text-[clamp(1.5rem,3vw,2rem)] text-primary">
            Built for how you actually live
          </h2>
          <p className="m-0 text-muted-foreground">
            Desktop-grade tools that feel native on your phone. Tap a card to start.
          </p>
        </div>
        <ul className="m-0 grid w-full list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
          {features.map((f) => (
            <li key={f.title}>
              <Link
                className="grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-xl border border-border bg-card text-inherit no-underline shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-brand-soft hover:shadow-[0_16px_36px_rgba(42,21,32,0.12)]"
                to={f.to}
              >
                <img
                  className="block aspect-[16/12] max-h-[260px] w-full bg-primary/8 object-cover object-center"
                  src={f.image}
                  alt={f.imageAlt}
                  width={640}
                  height={480}
                  loading="lazy"
                  decoding="async"
                />
                <span className="grid gap-2 px-[1.15rem] pt-[0.95rem] pb-[1.05rem]">
                  <strong className="font-[family-name:var(--font-display)] text-[1.2rem] text-foreground">
                    {f.title}
                  </strong>
                  <span className="leading-snug text-muted-foreground">{f.body}</span>
                  <span className="mt-0.5 text-[0.92rem] font-bold text-primary">
                    Get started
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="how-it-works"
        className={cn("scroll-mt-[4.5rem] grid gap-6 bg-card py-12", gutter)}
        aria-labelledby="steps-heading"
      >
        <div className="grid gap-3">
          <h2 id="steps-heading" className="m-0 text-[clamp(1.5rem,3vw,2rem)] text-primary">
            How it works
          </h2>
          <p className="m-0 text-muted-foreground">
            Three short steps from empty phone to a private wellness space.
          </p>
        </div>
        <ol className="m-0 grid w-full list-none gap-6 p-0 md:grid-cols-3 md:gap-4">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className={cn(
                "grid grid-cols-[auto_1fr] items-start gap-4 border-t border-border pt-4 md:grid-cols-1 md:border-t-0 md:border-r md:pt-0 md:pr-3",
                i === steps.length - 1 && "md:border-r-0",
              )}
            >
              <span
                className="grid size-10 place-items-center rounded-full bg-primary/12 font-[family-name:var(--font-display)] text-[1.05rem] font-bold text-primary"
                aria-hidden="true"
              >
                {s.n}
              </span>
              <div>
                <strong className="mb-1.5 block font-[family-name:var(--font-display)] text-[1.15rem] text-foreground">
                  {s.title}
                </strong>
                <p className="m-0 leading-snug text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="pt-2">
          <Button asChild>
            <Link to="/signup">Create your account</Link>
          </Button>
        </div>
      </section>

      <section
        id="privacy"
        className={cn(
          "scroll-mt-[4.5rem] grid gap-6 border-t border-border bg-surface-soft py-12",
          gutter,
        )}
        aria-labelledby="privacy-heading"
      >
        <div className="grid gap-3">
          <h2 id="privacy-heading" className="m-0 text-[clamp(1.5rem,3vw,2rem)] text-primary">
            Private by design
          </h2>
          <p className="m-0 text-muted-foreground">
            Built for UK, Nigeria, and Ghana — with consent you control and no
            health content in notification bodies.
          </p>
        </div>
        <ul className="m-0 grid w-full list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
          {[
            {
              title: "Your consents, your call",
              body: "Turn analytics, Zara, and HealthLens on or off anytime in Account.",
            },
            {
              title: "Export or delete",
              body: "Download your data as JSON, or request deletion with a 24-hour cooling-off window.",
            },
            {
              title: "Wellness only",
              body: "We never diagnose. Patterns and Prep Cards help you talk to a clinician.",
            },
          ].map((p, i, arr) => (
            <li
              key={p.title}
              className={cn(
                "grid gap-1.5 border-t border-border pt-4 md:border-t-0 md:border-r md:pt-0 md:pr-4",
                i === arr.length - 1 && "md:border-r-0",
              )}
            >
              <strong className="font-[family-name:var(--font-display)] text-[1.1rem] text-foreground">
                {p.title}
              </strong>
              <span className="leading-snug text-muted-foreground">{p.body}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild>
            <Link to="/signup">Start free</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/privacy">Read privacy</Link>
          </Button>
        </div>
      </section>

      <footer
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 border-t border-border bg-surface-soft py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
          gutter,
        )}
      >
        <BrandMark size={28} className="text-[1.1rem] text-primary" />
        <nav className="flex flex-wrap gap-4" aria-label="Legal">
          {[
            ["/privacy", "Privacy"],
            ["/terms", "Terms"],
            ["/signin", "Sign in"],
          ].map(([to, label]) => (
            <Link
              key={to}
              to={to}
              className="inline-flex min-h-[var(--tap)] items-center text-muted-foreground no-underline hover:text-primary"
            >
              {label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
