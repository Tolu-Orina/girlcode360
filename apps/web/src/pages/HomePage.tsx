import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Hospital, Phone } from "lucide-react";
import { AppTour } from "@/components/blocks/app-tour";
import { HomeOverview } from "@/components/blocks/home-overview";
import { PageHeader } from "@/components/blocks/page-header";
import { AppPage } from "@/components/blocks/app-page";
import {
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
} from "@/components/blocks/states";
import { useOnline } from "@/hooks/use-online";
import { getEmergency, getMe } from "@/lib/api";
import { displayNameFromEmail, firstNameFromDisplay } from "@/lib/display-name";
import { apiBaseUrl } from "@/lib/config";
import { tourSeen } from "@/lib/tips";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import type { EmergencyNumber } from "../../../../packages/api-types/src/index";
import { EMERGENCY_BY_MARKET } from "../../../../packages/domain/src/index";

const TILES = [
  {
    to: "/app/cycle",
    label: "Cycle",
    copy: "Track your days and see your window.",
    src: "/home-images/women-cycle.png",
    alt: "Calendar and cycle care items",
  },
  {
    to: "/app/health",
    label: "Health",
    copy: "PMOS, pregnancy, TTC, and your wallet.",
    src: "/home-images/women-health.jpg",
    alt: "Health notes and care items",
  },
  {
    to: "/app/mirror",
    label: "Mirror",
    copy: "Skin, hair, makeup, and style in one place.",
    src: "/home-images/women-mirror.jpg",
    alt: "Woman looking into a mirror",
  },
  {
    to: "/app/marketplace",
    label: "Marketplace",
    copy: "Pharmacies, clinics, and beauty nearby.",
    src: "/home-images/marketplace.jpg",
    alt: "Storefronts and local shops",
  },
  {
    to: "/app/library",
    label: "Library",
    copy: "Articles to help you prepare, not diagnose.",
    src: "/home-images/library.jpg",
    alt: "Open books on a table",
  },
  {
    to: "/app/community",
    label: "Community",
    copy: "Opt-in peer groups, text only.",
    src: "/home-images/women-community.jpg",
    alt: "Women together in conversation",
  },
  {
    to: "/app/inbox",
    label: "Inbox",
    copy: "Notices about listings you follow.",
    src: "/home-images/mail-inbox.jpg",
    alt: "Letters and an inbox",
  },
] as const;

export function HomePage() {
  const [numbers, setNumbers] = useState<EmergencyNumber[]>([]);
  const [market, setMarket] = useState<"UK" | "NG" | "GH">("UK");
  const [name, setName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(() => !tourSeen());
  const online = useOnline();
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (apiBaseUrl) {
        const me = await getMe();
        setMarket(me.market);
        const derived = displayNameFromEmail(me.email);
        setName(derived ? firstNameFromDisplay(derived) : undefined);
        const em = await getEmergency();
        setNumbers(em.numbers);
      } else {
        setNumbers(EMERGENCY_BY_MARKET.UK);
      }
    } catch {
      setNumbers(EMERGENCY_BY_MARKET[market]);
      setError(
        "Could not load emergency numbers. Showing numbers stored on this device.",
      );
    } finally {
      setLoading(false);
    }
  }, [market]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppPage className="max-w-none gap-0">
      {showTour ? <AppTour onDone={() => setShowTour(false)} /> : null}
      <PageHeader
        title={name ? `Welcome, ${name}` : "Welcome"}
        lead="Your health, beauty, and what you need nearby — in one connected picture. Ask Alena from the button whenever you need her."
      />

      <div className="mt-6">
        <HomeOverview />
      </div>

      {!online ? <OfflineBanner /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <section className="mt-12 grid gap-6">
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Spaces
        </h2>
      {loading ? (
        <div
          className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6"
          aria-busy="true"
          aria-label="Loading shortcuts"
        >
          {TILES.map((t) => (
            <SkeletonBlock key={t.to} className="aspect-[4/3] rounded-[var(--radius-sheet)]" />
          ))}
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 lg:grid-cols-3 lg:gap-6">
          {TILES.map((t) => (
            <li key={t.to} className="min-h-0">
              <motion.div
                className="h-full"
                whileHover={reduce ? undefined : { y: -4 }}
                transition={{ type: "spring", stiffness: 380, damping: 24 }}
              >
                <Link
                  to={t.to}
                  className={cn(
                    "flex h-full flex-col overflow-hidden rounded-[var(--radius-sheet)] bg-card text-foreground no-underline shadow-[var(--shadow-2)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span className="aspect-[4/3] overflow-hidden">
                    <img
                      src={t.src}
                      alt={t.alt}
                      width={800}
                      height={600}
                      className="size-full object-cover object-[center_20%]"
                      decoding="async"
                    />
                  </span>
                  <span className="grid gap-1 px-4 py-3">
                    <span className="font-[family-name:var(--font-display)] text-[length:var(--text-label)] font-semibold text-foreground">
                      {t.label}
                    </span>
                    <span className="hidden text-[length:var(--text-caption)] leading-snug text-muted-foreground sm:block">
                      {t.copy}
                    </span>
                  </span>
                </Link>
              </motion.div>
            </li>
          ))}
        </ul>
      )}
      </section>

      <section className="mt-12 grid gap-4">
        <h2 className="m-0 flex items-center gap-2 text-[length:var(--text-section)] text-foreground">
          <Hospital size={24} strokeWidth={1.75} aria-hidden="true" />
          Emergency
        </h2>
        <p className="m-0 text-[length:var(--text-body)] text-muted-foreground">
          Call these numbers if you need urgent help.
        </p>
        {loading ? (
          <SkeletonBlock className="h-16" />
        ) : (
          <ul className="m-0 flex list-none flex-wrap items-start gap-x-8 gap-y-3 p-0">
            {numbers.map((n) => (
              <li key={n.number} className="min-w-0">
                <strong className="block text-[length:var(--text-caption)] text-muted-foreground">
                  {n.label}
                </strong>
                <a
                  className="inline-flex min-h-[var(--tap)] items-center gap-2 text-[length:var(--text-sub)] font-bold text-primary no-underline"
                  href={`tel:${n.number}`}
                >
                  <Phone className="size-5 shrink-0" aria-hidden />
                  {n.number}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppPage>
  );
}
