import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { ApiError, getMe } from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import "../pages/onboarding.css";

/** Gate /app until onboardingComplete. */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "need" | "skip">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!apiBaseUrl) {
        if (!cancelled) setState("skip");
        return;
      }
      try {
        const me = await getMe();
        if (!cancelled) setState(me.onboardingComplete ? "ok" : "need");
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
            setState("need");
          } else {
            setState("need");
          }
        }
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
