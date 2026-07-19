import { PCOS_ARTICLES } from "./pcos";
import type { Market } from "../types";

export type ContentArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  topic: "pcos" | "cycle" | "pregnancy" | "ttc" | "privacy" | "general";
  markets: Market[];
};

const EXTRA: ContentArticle[] = [
  {
    id: "cycle-basics",
    title: "Cycle logging basics",
    summary: "How gentle daily logs support clinic conversations.",
    body: "Record period start dates, flow, and symptoms that matter to you. Patterns over time are useful context for clinicians — not a diagnosis.",
    topic: "cycle",
    markets: ["UK", "NG", "GH"],
  },
  {
    id: "pregnancy-kick-counts",
    title: "Noticing foetal movement",
    summary: "Awareness tips — always follow local clinical guidance.",
    body: "Many clinics ask you to notice movement patterns in later pregnancy. If movements change suddenly, contact emergency or maternity triage for your area. GirlCode360 does not replace clinical advice.",
    topic: "pregnancy",
    markets: ["UK", "NG", "GH"],
  },
  {
    id: "ttc-timing",
    title: "Fertile window awareness",
    summary: "Wellness framing for trying-to-conceive timing.",
    body: "Predicted fertile windows are estimates from logged cycles. They are not a guarantee of ovulation. Speak with a clinician if you have questions about fertility care.",
    topic: "ttc",
    markets: ["UK", "NG", "GH"],
  },
  {
    id: "privacy-your-data",
    title: "Your data, your controls",
    summary: "Export, consents, and account deletion in GirlCode360.",
    body: "Use Privacy Centre to review consents, download a JSON export, or request deletion with a 24-hour cooling-off period. Health Wallet files stay client-encrypted.",
    topic: "privacy",
    markets: ["UK", "NG", "GH"],
  },
];

export function contentArticles(
  market: Market,
  topic?: string,
): ContentArticle[] {
  const pcos: ContentArticle[] = PCOS_ARTICLES.filter((a) =>
    a.markets.includes(market),
  ).map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    body: a.body,
    topic: "pcos" as const,
    markets: a.markets,
  }));
  const all = [...pcos, ...EXTRA.filter((a) => a.markets.includes(market))];
  if (!topic) return all;
  return all.filter((a) => a.topic === topic);
}
