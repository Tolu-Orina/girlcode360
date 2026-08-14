import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthAlert, AuthShell } from "@/components/AuthShell";
import { Field, FieldInput } from "@/components/primitives/field";
import {
  AuthOfflineNote,
  PasswordField,
} from "@/components/primitives/password-field";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-media-query";
import { mapAuthError } from "@/lib/auth-errors";
import { signIn } from "@/lib/cognito";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export function SignInPage() {
  const navigate = useNavigate();
  const online = useOnline();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!online) {
      setError("You are offline. Connect, then try again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigate("/onboarding");
    } catch (err) {
      setError(mapAuthError(err, "signin"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      lead="Welcome back. Your logs stay private."
      panelImage="/images/auth-panel-welcome.png"
      panelAlt="Woman resting by a sunlit window with a calm wellness moment"
      footer={
        <p className="m-0 text-[length:var(--text-label)]">
          <Link
            to="/signup"
            className="inline-flex min-h-[var(--tap)] items-center font-semibold text-primary no-underline hover:underline"
          >
            Create account
          </Link>
        </p>
      }
    >
      <GoogleSignInButton
        disabled={busy || !online}
        onError={setError}
      />
      <form className="grid w-full gap-4" onSubmit={(e) => void onSubmit(e)}>
        <Field id="signin-email" label="Email">
          <FieldInput
            id="signin-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <PasswordField
          id="signin-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
          show={showPw}
          onToggleShow={() => setShowPw((v) => !v)}
          extra={
            <Link
              to="/forgot-password"
              className="inline-flex min-h-[var(--tap)] items-center text-[length:var(--text-label)] font-semibold text-primary no-underline hover:underline"
            >
              Forgot password?
            </Link>
          }
        />
        <AuthOfflineNote online={online} />
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        <Button className="w-full" type="submit" disabled={busy || !online}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}