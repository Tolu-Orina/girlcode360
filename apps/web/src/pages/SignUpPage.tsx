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
import { signUp } from "@/lib/cognito";
import { PASSWORD_HINT, passwordPolicyError } from "@/lib/password-policy";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export function SignUpPage() {
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
    const policy = passwordPolicyError(password);
    if (policy) {
      setError(policy);
      setBusy(false);
      return;
    }
    try {
      await signUp(email.trim(), password);
      navigate(`/verify?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setError(mapAuthError(err, "signup"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      lead="You must be 18 or older. We will email a verification code."
      panelImage="/images/auth-panel-morning.png"
      panelAlt="Woman starting her morning with a calm, welcoming smile"
      footer={
        <p className="m-0 text-[length:var(--text-label)]">
          <Link
            to="/signin"
            className="inline-flex min-h-[var(--tap)] items-center font-semibold text-primary no-underline hover:underline"
          >
            Already have an account? Sign in
          </Link>
        </p>
      }
    >
      <GoogleSignInButton
        disabled={busy || !online}
        onError={setError}
      />
      <form className="grid w-full gap-4" onSubmit={(e) => void onSubmit(e)}>
        <Field id="signup-email" label="Email">
          <FieldInput
            id="signup-email"
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
          id="signup-password"
          name="password"
          label="Password"
          hint={PASSWORD_HINT}
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={setPassword}
          show={showPw}
          onToggleShow={() => setShowPw((v) => !v)}
        />
        <AuthOfflineNote online={online} />
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        <Button className="w-full" type="submit" disabled={busy || !online}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}