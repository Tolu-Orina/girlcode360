import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldInput } from "@/components/primitives/field";
import {
  appLockEnabled,
  assertWebAuthn,
  hasPin,
  hasWebAuthn,
  unlockWithPin,
  webauthnAvailable,
} from "@/lib/walletGate";

const HIDDEN_AT = "gc360.lock.hiddenAt";
const RELOCK_MS = 60_000;

export function AppLock({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => appLockEnabled());
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!appLockEnabled()) return;
    function onVis() {
      if (document.hidden) {
        sessionStorage.setItem(HIDDEN_AT, String(Date.now()));
        return;
      }
      const hiddenAt = Number(sessionStorage.getItem(HIDDEN_AT) ?? "0");
      if (Date.now() - hiddenAt >= RELOCK_MS) setLocked(true);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!locked) return;
    if (!hasWebAuthn() || !webauthnAvailable()) return;
    let cancelled = false;
    (async () => {
      const ok = await assertWebAuthn();
      if (!cancelled && ok) setLocked(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [locked]);

  if (!locked) return children;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ok = await unlockWithPin(pin);
      if (!ok) {
        setError("That PIN is not correct.");
        return;
      }
      setPin("");
      setLocked(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-content-center bg-background px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <form className="grid w-full max-w-[var(--auth-max)] gap-4" onSubmit={(e) => void onSubmit(e)}>
        <h1 className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-section)] text-foreground">
          Unlock GirlCode360
        </h1>
        <p className="m-0 text-[length:var(--text-body)] text-muted-foreground">
          {hasPin()
            ? "Enter your device PIN. Face ID or Touch ID runs first when it is set up."
            : "Choose a PIN of at least 4 digits. You can add Face ID in Account."}
        </p>
        <Field id="app-lock-pin" label="PIN">
          <FieldInput
            id="app-lock-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            minLength={4}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </Field>
        {error ? (
          <p className="m-0 text-[length:var(--text-label)] text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}
