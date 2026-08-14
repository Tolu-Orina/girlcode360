import { useContext } from "react";
import {
  AlenaContext,
  type AlenaContextValue,
} from "@/components/blocks/alena-store";

export function useAlena(): AlenaContextValue {
  const ctx = useContext(AlenaContext);
  if (!ctx) throw new Error("useAlena must be used within AlenaProvider");
  return ctx;
}
