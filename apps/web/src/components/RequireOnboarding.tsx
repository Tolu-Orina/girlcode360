import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { ApiError, getMe } from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import "../pages/onboarding.css";

const CACHE_KEY = "gc_onboarding_complete";

/** Gate /app until onboardingComplete — allow offline when cached complete. */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "need">("loading");

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
        if (me.onboardingComplete) {
          localStorage.setItem(CACHE_KEY, "1");
          setState("ok");
        } else {
          localStorage.removeItem(CACHE_KEY);
          setState("need");
        }
      } catch (err) {
        if (cancelled) return;
        // Auth failures → onboarding; network/5xx → respect offline cache
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          localStorage.removeItem(CACHE_KEY);
          setState("need");
          return;
        }
        if (localStorage.getItem(CACHE_KEY) === "1") {
          setState("ok");
          return;
        }
        // Offline with no cache: still enter app so cycle IDB can work
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
    return (
      <main className="onboarding-page">
        <p className="onboarding-lead">Preparing your space…</p>
      </main>
    );
  }
  if (state === "need") {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}
