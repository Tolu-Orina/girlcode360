import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthAlert, AuthShell } from "@/components/AuthShell";
import { Field, FieldInput } from "@/components/primitives/field";
import {
  AuthOfflineNote,
  PasswordField,
} from "@/components/primitives/password-field";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-media-query";
import { isAuthConfigError, mapAuthError } from "@/lib/auth-errors";
import { confirmForgotPassword, forgotPassword } from "@/lib/cognito";
import { PASSWORD_HINT, passwordPolicyError } from "@/lib/password-policy";

export function ForgotPasswordPage() {
  const online = useOnline();
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    if (!online) {
      setError("You are offline. Connect, then try again.");
      return;
    }
    setBusy(true);
    setError(null);
    const generic = `If an account exists for ${email.trim()}, we sent a code.`;
    try {
      await forgotPassword(email.trim());
    } catch (err) {
      if (isAuthConfigError(err) || (typeof navigator !== "undefined" && !navigator.onLine)) {
        setError(mapAuthError(err, "reset"));
        setBusy(false);
        return;
      }
    }
    setMessage(generic);
    setStep("confirm");
    setBusy(false);
  }

  async function onConfirm(e: FormEvent) {
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
      await confirmForgotPassword(email.trim(), code.trim(), password);
      setMessage("Password updated. You can sign in.");
    } catch (err) {
      setError(mapAuthError(err, "reset"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      lead="We will email a code, then you choose a new password."
      panelImage="/images/auth-panel-journal.png"
      panelAlt="Quiet journaling moment suggesting a calm reset"
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
      {step === "request" ? (
        <form className="grid w-full gap-4" onSubmit={(e) => void onRequest(e)}>
          <Field id="forgot-email" label="Email">
            <FieldInput
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <AuthOfflineNote online={online} />
          {error ? <AuthAlert>{error}</AuthAlert> : null}
          <Button className="w-full" type="submit" disabled={busy || !online}>
            {busy ? "Sending…" : "Send code"}
          </Button>
        </form>
      ) : (
        <form className="grid w-full gap-4" onSubmit={(e) => void onConfirm(e)}>
          {message ? (
            <p className="m-0 text-[length:var(--text-label)] text-ok" role="status">
              {message}
            </p>
          ) : null}
          <Field id="forgot-code" label="Code">
            <FieldInput
              id="forgot-code"
              name="one-time-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <PasswordField
            id="forgot-password"
            name="new-password"
            label="New password"
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
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}