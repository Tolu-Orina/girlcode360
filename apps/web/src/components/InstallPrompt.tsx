import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useStandalone } from "@/hooks/use-media-query";
import { track } from "@/lib/analytics";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const standalone = useStandalone();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("gc_install_dismissed") === "1",
  );

  useEffect(() => {
    function onBip(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (standalone || !deferred || dismissed) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    track({
      name:
        outcome === "accepted" ? "pwa_install_accepted" : "pwa_install_dismissed",
    });
    setDeferred(null);
    if (outcome === "dismissed") {
      localStorage.setItem("gc_install_dismissed", "1");
      setDismissed(true);
    }
  }

  function dismiss() {
    localStorage.setItem("gc_install_dismissed", "1");
    setDismissed(true);
    track({ name: "pwa_install_dismissed" });
  }

  return (
    <div
      className="glass-surface relative z-20 flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3"
      role="region"
      aria-label="Install app"
    >
      <p className="m-0 text-sm text-muted-foreground">
        Add GirlCode360 to your home screen for offline shell access.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void install()}>
          Install
        </Button>
        <Button type="button" variant="outline" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
