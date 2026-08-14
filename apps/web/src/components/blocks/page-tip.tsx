import { useState } from "react";
import { outlinedCardClass } from "@/components/blocks/app-page";
import { Button } from "@/components/ui/button";
import { PAGE_TIPS } from "../../../../../packages/domain/src/index";
import { markTipSeen, tipSeen } from "@/lib/tips";

export function PageTip({ id }: { id: keyof typeof PAGE_TIPS }) {
  const copy = PAGE_TIPS[id];
  const [hidden, setHidden] = useState(() => tipSeen(id));
  if (!copy || hidden) return null;

  return (
    <aside className={outlinedCardClass} role="note">
      <p className="m-0 text-[length:var(--text-label)] font-semibold text-foreground">
        {copy.title}
      </p>
      <p className="m-0 mt-2 text-[length:var(--text-body)] text-muted-foreground">
        {copy.body}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={() => {
          markTipSeen(id);
          setHidden(true);
        }}
      >
        Got it
      </Button>
    </aside>
  );
}
