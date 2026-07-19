import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmForgotPassword, forgotPassword } from "@/lib/cognito";

export function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setMessage("If that email exists, a code is on its way.");
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await confirmForgotPassword(email.trim(), code.trim(), password);
      setMessage("Password updated. You can sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      lead="We’ll email a code, then you choose a new password."
      panelImage="/images/auth-panel-journal.png"
      panelAlt="Quiet journaling moment suggesting a calm reset"
      footer={
        <p className="mt-2 flex flex-wrap gap-4 text-[0.95rem]">
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
        <form
          className="mt-2 grid w-full gap-4"
          onSubmit={(e) => void onRequest(e)}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              className="h-12"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error ? (
            <p className="m-0 text-[0.92rem] text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </Button>
        </form>
      ) : (
        <form
          className="mt-2 grid w-full gap-4"
          onSubmit={(e) => void onConfirm(e)}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="forgot-code">Code</Label>
            <Input
              id="forgot-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              className="h-12"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="forgot-password">New password</Label>
            <Input
              id="forgot-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="h-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p className="m-0 text-[0.92rem] text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="m-0 text-[0.92rem] text-ok">{message}</p>
          ) : null}
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
