import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";
import { getCurrentSession } from "@/lib/cognito";
import { apiBaseUrl } from "@/lib/config";
import {
  displayNameFromClaims,
  displayNameFromEmail,
  initialsFromName,
} from "@/lib/display-name";

export type SessionUser = {
  email?: string;
  displayName: string | null;
  initials: string;
};

function fromDevStorage(): SessionUser {
  try {
    const raw = sessionStorage.getItem("gc360.devSub");
    if (!raw) return { displayName: null, initials: "G" };
    const parsed = JSON.parse(raw) as { email?: string };
    const displayName = displayNameFromEmail(parsed.email);
    return {
      email: parsed.email,
      displayName,
      initials: initialsFromName(displayName ?? parsed.email ?? "G"),
    };
  } catch {
    return { displayName: null, initials: "G" };
  }
}

export function useSessionUser(): SessionUser {
  const [user, setUser] = useState<SessionUser>({
    displayName: null,
    initials: "G",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let email: string | undefined;
      let displayName: string | null = null;
      try {
        const session = await getCurrentSession();
        if (session) {
          const claims = session.getIdToken().decodePayload() as {
            email?: string;
            name?: string;
            given_name?: string;
          };
          email = claims.email;
          displayName = displayNameFromClaims(claims);
        }
      } catch {
        /* cognito unset */
      }
      if (apiBaseUrl) {
        try {
          const me = await getMe();
          email = me.email ?? email;
          if (!displayName) displayName = displayNameFromEmail(me.email);
        } catch {
          /* keep claims */
        }
      } else if (!email) {
        const dev = fromDevStorage();
        if (cancelled) return;
        setUser(dev);
        return;
      }
      if (cancelled) return;
      setUser({
        email,
        displayName,
        initials: initialsFromName(displayName ?? email ?? "G"),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
