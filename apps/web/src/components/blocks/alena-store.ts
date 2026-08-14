import { createContext } from "react";

export type AlenaOpenedFrom =
  | "cycle"
  | "health"
  | "mirror"
  | "home"
  | "library"
  | undefined;

export type AlenaPanelTab = "chat" | "lens";

export type AlenaOpenOpts = {
  from?: AlenaOpenedFrom;
  ask?: string | null;
  panel?: AlenaPanelTab;
};

export type AlenaContextValue = {
  open: boolean;
  opts: AlenaOpenOpts;
  openAlena: (opts?: AlenaOpenOpts) => void;
  closeAlena: () => void;
};

export const AlenaContext = createContext<AlenaContextValue | null>(null);
