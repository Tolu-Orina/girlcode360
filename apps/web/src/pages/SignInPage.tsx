import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/cognito";

export function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigate("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
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
        <p className="mt-2 flex flex-wrap justify-between gap-4 text-[0.95rem]">
          <Link
            to="/signup"
            className="inline-flex min-h-[var(--tap)] items-center font-semibold text-primary no-underline hover:underline"
          >
            Create account
          </Link>
          <Link
            to="/forgot-password"
            className="inline-flex min-h-[var(--tap)] items-center font-semibold text-primary no-underline hover:underline"
          >
            Forgot password
          </Link>
        </p>
      }
    >
      <form className="mt-2 grid w-full gap-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-1.5">
          <Label htmlFor="signin-email">Email</Label>
          <Input
            id="signin-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            className="h-12"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="signin-password">Password</Label>
          <Input
            id="signin-password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-normal text-muted-foreground">
          <Checkbox
            checked={showPw}
            onCheckedChange={(v) => setShowPw(v === true)}
            aria-label="Show password"
          />
          Show password
        </label>
        {error ? (
          <p className="m-0 text-[0.92rem] text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="w-full" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
