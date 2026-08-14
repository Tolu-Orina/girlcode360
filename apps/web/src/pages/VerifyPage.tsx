import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthAlert, AuthShell } from "@/components/AuthShell";
import { Field, FieldInput } from "@/components/primitives/field";
import { AuthOfflineNote } from "@/components/primitives/password-field";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-media-query";
import { mapAuthError } from "@/lib/auth-errors";
import { confirmSignUp } from "@/lib/cognito";

export function VerifyPage() {
  const navigate = useNavigate();
  const online = useOnline();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
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
      await confirmSignUp(email.trim(), code.trim());
      navigate("/signin");
    } catch (err) {
      setError(mapAuthError(err, "verify"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Verify your email"
      lead="Enter the 6-digit code we sent, then you can sign in."
      panelImage="/images/auth-panel-journal.png"
      panelAlt="Woman journaling quietly in a soft rose-toned room"
      footer={
        <p className="m-0 text-[length:var(--text-label)]">
          <Link
            to="/signin"
            className="inline-flex min-h-[var(--tap)] items-center font-semibold text-primary no-underline hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
      <form className="grid w-full gap-4" onSubmit={(e) => void onSubmit(e)}>
        <Field id="verify-email" label="Email">
          <FieldInput
            id="verify-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field id="verify-code" label="Verification code">
          <FieldInput
            id="verify-code"
            name="one-time-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus={Boolean(params.get("email"))}
            required
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <AuthOfflineNote online={online} />
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        <Button className="w-full" type="submit" disabled={busy || !online}>
          {busy ? "Verifying…" : "Verify email"}
        </Button>
      </form>
    </AuthShell>
  );
}