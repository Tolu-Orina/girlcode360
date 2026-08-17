import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";
import { getCurrentSession } from "@/lib/cognito";
import { apiBaseUrl, cognitoConfig } from "@/lib/config";

const ONBOARDING_CACHE = "gc_onboarding_complete";

export type MarketingAuth = {
  ready: boolean;
  signedIn: boolean;
  /** Where a signed-in visitor should land. */
  continueTo: "/app" | "/onboarding";
};

export type MarketingCtas = {
  primaryTo: string;
  primaryLabel: string;
  secondaryTo: string | null;
  secondaryLabel: string | null;
};

export function marketingCtas(auth: MarketingAuth): MarketingCtas {
  if (auth.signedIn) {
    if (auth.continueTo === "/onboarding") {
      return {
        primaryTo: "/onboarding",
        primaryLabel: "Continue setup",
        secondaryTo: null,
        secondaryLabel: null,
      };
    }
    return {
      primaryTo: "/app",
      primaryLabel: "Open Home",
      secondaryTo: null,
      secondaryLabel: null,
    };
  }
  return {
    primaryTo: "/signup",
    primaryLabel: "Create account",
    secondaryTo: "/signin",
    secondaryLabel: "Sign in",
  };
}

export function useMarketingAuth(): MarketingAuth {
  const [auth, setAuth] = useState<MarketingAuth>({
    ready: false,
    signedIn: false,
    continueTo: "/app",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let signedIn = false;
      if (cognitoConfig.userPoolId && cognitoConfig.clientId) {
        try {
          signedIn = Boolean(await getCurrentSession());
        } catch {
          signedIn = false;
        }
      }
      let continueTo: "/app" | "/onboarding" = "/app";
      if (signedIn && apiBaseUrl) {
        try {
          const me = await getMe();
          continueTo = me.ageConfirmed18 && me.onboardingComplete
            ? "/app"
            : "/onboarding";
        } catch {
          continueTo =
            localStorage.getItem(ONBOARDING_CACHE) === "1"
              ? "/app"
              : "/onboarding";
        }
      }
      if (!cancelled) {
        setAuth({ ready: true, signedIn, continueTo });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return auth;
}
