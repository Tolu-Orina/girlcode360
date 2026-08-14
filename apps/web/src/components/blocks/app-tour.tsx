import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ONBOARDING_TOUR } from "../../../../../packages/domain/src/index";
import { markTourSeen } from "@/lib/tips";

export function AppTour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = ONBOARDING_TOUR[i]!;
  const last = i >= ONBOARDING_TOUR.length - 1;

  function finish() {
    markTourSeen();
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-end bg-foreground/40 p-4 sm:place-items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-tour-title"
    >
      <div className="w-full max-w-[var(--auth-max)] rounded-[var(--radius)] border border-border bg-card p-6 shadow-[var(--shadow-modal)]">
        <p className="m-0 text-[length:var(--text-caption)] font-semibold text-primary">
          {i + 1} of {ONBOARDING_TOUR.length}
        </p>
        <h2
          id="app-tour-title"
          className="m-0 mt-2 text-[length:var(--text-section)] text-foreground"
        >
          {step.title}
        </h2>
        <p className="m-0 mt-2 text-[length:var(--text-body)] text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              if (last) finish();
              else setI((n) => n + 1);
            }}
          >
            {last ? "Done" : "Next"}
          </Button>
          <Button type="button" variant="outline" onClick={finish}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
