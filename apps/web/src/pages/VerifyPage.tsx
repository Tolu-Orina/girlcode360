import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmSignUp } from "@/lib/cognito";

export function VerifyPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await confirmSignUp(email.trim(), code.trim());
      navigate("/signin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Verify your email"
      lead="Enter the code we sent — then you can sign in."
      panelImage="/images/auth-panel-journal.png"
      panelAlt="Woman journaling quietly in a soft rose-toned room"
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
      <form className="mt-2 grid w-full gap-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-1.5">
          <Label htmlFor="verify-email">Email</Label>
          <Input
            id="verify-email"
            type="email"
            autoComplete="email"
            required
            className="h-12"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="verify-code">Verification code</Label>
          <Input
            id="verify-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            className="h-12"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        {error ? (
          <p className="m-0 text-[0.92rem] text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="w-full" type="submit" disabled={busy}>
          {busy ? "Verifying…" : "Verify"}
        </Button>
      </form>
    </AuthShell>
  );
}
