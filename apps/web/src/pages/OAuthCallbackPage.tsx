import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthAlert, AuthShell } from "@/components/AuthShell";
import { GateScreen } from "@/components/blocks/gate-screen";
import { Button } from "@/components/ui/button";
import { mapAuthError } from "@/lib/auth-errors";
import { completeGoogleSignIn } from "@/lib/cognito";

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await completeGoogleSignIn(params);
        if (!cancelled) navigate("/onboarding", { replace: true });
      } catch (err) {
        if (!cancelled) setError(mapAuthError(err, "oauth"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  if (error) {
    return (
      <AuthShell title="Could not finish Google sign-in" lead={undefined}>
        <AuthAlert>{error}</AuthAlert>
        <Button type="button" variant="outline" onClick={() => navigate("/signin")}>
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  return <GateScreen message="Finishing Google sign-in…" />;
}
