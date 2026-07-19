import {
  buildPcosInsights,
  daysBetween,
} from "../../../../../../packages/domain/src/index";
import { listBiometrics, listCycles, listDays } from "../store/memory";
import type { Market } from "../types";

export const PCOS_ARTICLES = [
  {
    id: "pcos-what-is",
    title: "Understanding PCOS (wellness overview)",
    markets: ["UK", "NG", "GH"] as Market[],
    summary:
      "PCOS is a common hormone-related condition. Only a qualified clinician can assess or diagnose. This article shares general wellness context.",
    body: "Many people notice irregular cycles, skin changes, or energy shifts. Tracking symptoms can help conversations with your GP or clinic. GirlCode360 does not diagnose conditions.",
  },
  {
    id: "pcos-nhs-uk",
    title: "Talking to your GP (UK)",
    markets: ["UK"] as Market[],
    summary:
      "Tips for preparing a calm, factual summary for an NHS GP appointment.",
    body: "Bring your cycle dates, symptom diary, and medication list. Ask about investigations your clinician may consider. Avoid self-labelling — describe what you experience.",
  },
  {
    id: "pcos-nutrition-ng",
    title: "Everyday energy & food rhythms (Nigeria)",
    markets: ["NG"] as Market[],
    summary: "Gentle ideas for steady energy — not a treatment plan.",
    body: "Balanced meals, hydration, and sleep routines support wellness. Local dietitians or clinicians can advise what fits your health history. This is education, not medical advice.",
  },
  {
    id: "pcos-ghs-gh",
    title: "Finding care pathways (Ghana)",
    markets: ["GH"] as Market[],
    summary:
      "How logged patterns can support a clinic visit via Ghana Health Service or private care.",
    body: "Share timelines of cycles and symptoms. Clinicians decide next steps. GirlCode360 is a wellness companion, not a diagnostic tool.",
  },
  {
    id: "pcos-stress-sleep",
    title: "Stress, sleep, and cycle irregularity",
    markets: ["UK", "NG", "GH"] as Market[],
    summary:
      "Possible patterns between sleep, stress scores, and cycle length — for awareness only.",
    body: "When sleep is short or stress is high, some people notice cycle changes. Logging biometrics can surface possible patterns. Patterns are not proof of a diagnosis.",
  },
];

export function pcosInsightsForUser(sub: string) {
  const cycles = listCycles(sub);
  const starts = cycles.map((c) => c.startDate).sort();
  const intervals: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    intervals.push(daysBetween(starts[i - 1]!, starts[i]!));
  }
  const days = listDays(sub);
  const recent = days.slice(-60);
  const recentSymptomIds = recent.flatMap((d) => d.symptomIds);
  const bios = listBiometrics(sub);
  const recentStressScores = bios
    .slice(-30)
    .map((b) => b.stress)
    .filter((s): s is 1 | 2 | 3 | 4 | 5 => s != null);

  return buildPcosInsights({
    cycleIntervalsDays: intervals,
    recentSymptomIds,
    recentStressScores,
  });
}

export function articlesForMarket(market: Market) {
  return PCOS_ARTICLES.filter((a) => a.markets.includes(market));
}
