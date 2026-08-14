import { Navigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useAlena } from "@/hooks/use-alena";
import type { AlenaOpenedFrom, AlenaPanelTab } from "@/components/blocks/alena-context";

function openedFromParam(raw: string | null): AlenaOpenedFrom {
  if (
    raw === "cycle" ||
    raw === "health" ||
    raw === "mirror" ||
    raw === "home" ||
    raw === "library"
  ) {
    return raw;
  }
  return undefined;
}

export function AlenaRoute() {
  const { openAlena } = useAlena();
  const [params] = useSearchParams();

  useEffect(() => {
    const panel: AlenaPanelTab = params.get("panel") === "lens" ? "lens" : "chat";
    openAlena({
      from: openedFromParam(params.get("from")),
      ask: params.get("ask"),
      panel,
    });
  }, [openAlena, params]);

  return <Navigate to="/app" replace />;
}
