import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { GateScreen } from "@/components/blocks/gate-screen";
import { ApiError, CURRENT_POLICY_VERSION, getConsents, getMe } from "../lib/api";
import { apiBaseUrl } from "../lib/config";

const CACHE_KEY = "gc_onboarding_complete";

/** Gate /app until onboardingComplete — allow offline when cached complete. */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "need" | "reconsent">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!apiBaseUrl) {
        if (!cancelled) setState("ok");
        return;
      }
      try {
        const me = await getMe();
        if (cancelled) return;
        if (!me.ageConfirmed18) {
          localStorage.removeItem(CACHE_KEY);
          setState("need");
          return;
        }
        if (me.onboardingComplete) {
          localStorage.setItem(CACHE_KEY, "1");
          try {
            const c = await getConsents();
            const health = c.current.find((x) => x.purpose === "health_data");
            if (!health?.granted || health.policyVersion !== CURRENT_POLICY_VERSION) {
              setState("reconsent");
              return;
            }
          } catch {
            /* still enter app if consents fail */
          }
          setState("ok");
        } else {
          localStorage.removeItem(CACHE_KEY);
          setState("need");
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "minor_blocked") {
          localStorage.removeItem(CACHE_KEY);
          setState("need");
          return;
        }
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          localStorage.removeItem(CACHE_KEY);
          setState("need");
          return;
        }
        if (localStorage.getItem(CACHE_KEY) === "1") {
          setState("ok");
          return;
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setState("ok");
          return;
        }
        setState("need");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return <GateScreen message="Preparing your space…" />;
  }
  if (state === "reconsent") {
    return <Navigate to="/onboarding?reconsent=1" replace />;
  }
  if (state === "need") {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}
