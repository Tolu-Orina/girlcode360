import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentSession } from "../lib/cognito";
import { cognitoConfig } from "../lib/config";
import "../pages/onboarding.css";

/**
 * When Cognito is configured, require a valid session.
 * When not configured (local scaffold), allow through so onboarding/API can
 * use the Bearer dev.* path.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "ok" | "no">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cognitoConfig.userPoolId || !cognitoConfig.clientId) {
        if (!cancelled) setState("ok");
        return;
      }
      try {
        const session = await getCurrentSession();
        if (!cancelled) setState(session ? "ok" : "no");
      } catch {
        if (!cancelled) setState("no");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <main className="onboarding-page">
        <p className="onboarding-lead">Checking session…</p>
      </main>
    );
  }
  if (state === "no") {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }
  return children;
}
