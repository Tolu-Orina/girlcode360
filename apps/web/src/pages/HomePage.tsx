import { Link } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  HeartPulse,
  MessageCircle,
  Phone,
  ScanFace,
  Store,
} from "lucide-react";
import { PageHeader } from "@/components/blocks/page-header";
import { AppPage } from "@/components/blocks/app-page";
import {
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
} from "@/components/blocks/states";
import { useOnline } from "@/hooks/use-online";
import { getEmergency, getMe } from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import type { EmergencyNumber } from "../../../../packages/api-types/src/index";
import { EMERGENCY_BY_MARKET } from "../../../../packages/domain/src/index";
import type { LucideIcon } from "lucide-react";

const TILES: {
  to: string;
  label: string;
  copy: string;
  icon: LucideIcon;
}[] = [
  {
    to: "/app/cycle",
    label: "Cycle",
    copy: "Log days and see your window",
    icon: CalendarDays,
  },
  {
    to: "/app/health",
    label: "Health",
    copy: "PMOS, pregnancy, TTC, wallet",
    icon: HeartPulse,
  },
  {
    to: "/app/mirror",
    label: "Mirror",
    copy: "Skin scores and try-on",
    icon: ScanFace,
  },
  {
    to: "/app/alena",
    label: "Alena",
    copy: "Ask for wellness guidance",
    icon: MessageCircle,
  },
  {
    to: "/app/marketplace",
    label: "Marketplace",
    copy: "Pharmacies, clinics, beauty nearby",
    icon: Store,
  },
  {
    to: "/app/library",
    label: "Library",
    copy: "Education articles",
    icon: BookOpen,
  },
];

export function HomePage() {
  const [numbers, setNumbers] = useState<EmergencyNumber[]>([]);
  const [market, setMarket] = useState<"UK" | "NG" | "GH">("UK");
  const [name, setName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (apiBaseUrl) {
        const me = await getMe();
        setMarket(me.market);
        setName(me.email?.split("@")[0]);
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
    <AppPage>
      <PageHeader
        eyebrow="Home"
        title={name ? `Hello, ${name}` : "Welcome"}
        lead="Your cycle, records, and city. Private wellness in one place."
      />

      {!online ? <OfflineBanner /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <div
          className="grid grid-cols-1 gap-6 min-[480px]:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Loading shortcuts"
        >
          {TILES.map((t) => (
            <SkeletonBlock key={t.to} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "grid min-h-24 gap-2 rounded-[var(--radius)] border border-border bg-card p-4 text-foreground no-underline",
                  "transition-shadow [@media(hover:hover)]:hover:shadow-[var(--shadow-2)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "active:scale-[0.99]",
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-6 shrink-0 text-primary" aria-hidden />
                  <span className="font-[family-name:var(--font-display)] text-[length:var(--text-sub)] text-primary">
                    {t.label}
                  </span>
                </span>
                <span className="text-[length:var(--text-label)] leading-normal text-muted-foreground">
                  {t.copy}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <section className="grid gap-3 border-t border-border pt-6">
        <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
          Emergency
        </h2>
        <p className="m-0 text-[length:var(--text-body)] text-muted-foreground">
          Call these numbers if you need urgent help.
        </p>
        {loading ? (
          <SkeletonBlock className="h-24" />
        ) : (
          <ul className="m-0 grid list-none gap-0 p-0">
            {numbers.map((n) => (
              <li
                key={n.number}
                className="border-b border-border py-4 last:border-b-0"
              >
                <strong className="block text-[length:var(--text-body)] text-foreground">
                  {n.label}
                </strong>
                <a
                  className="inline-flex min-h-[var(--tap)] items-center gap-2 text-[length:var(--text-sub)] font-bold text-primary no-underline"
                  href={`tel:${n.number}`}
                >
                  <Phone className="size-6 shrink-0" aria-hidden />
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
