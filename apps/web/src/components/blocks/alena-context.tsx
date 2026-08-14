import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  AlenaContext,
  type AlenaOpenOpts,
} from "@/components/blocks/alena-store";

export type {
  AlenaOpenedFrom,
  AlenaPanelTab,
  AlenaOpenOpts,
} from "@/components/blocks/alena-store";

export function AlenaProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<AlenaOpenOpts>({});

  const openAlena = useCallback((next?: AlenaOpenOpts) => {
    setOpts(next ?? {});
    setOpen(true);
  }, []);

  const closeAlena = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, opts, openAlena, closeAlena }),
    [open, opts, openAlena, closeAlena],
  );

  return <AlenaContext.Provider value={value}>{children}</AlenaContext.Provider>;
}
