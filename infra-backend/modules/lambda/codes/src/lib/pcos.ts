import {
  buildPcosInsights,
  daysBetween,
  LIBRARY_ARTICLES,
  libraryArticles,
} from "../../../../../../packages/domain/src/index";
import { listBiometrics, listCycles, listDays } from "../store/memory";
import type { Market } from "../types";

export const PCOS_ARTICLES = LIBRARY_ARTICLES.filter((a) => a.topic === "pcos").map(
  (a) => ({
    id: a.id,
    title: a.title,
    markets: a.markets as Market[],
    summary: a.summary,
    body: a.body,
    reviewedAt: a.reviewedAt,
  }),
);

export async function pcosInsightsForUser(sub: string) {
  const cycles = await listCycles(sub);
  const starts = cycles.map((c) => c.startDate).sort();
  const intervals: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    intervals.push(daysBetween(starts[i - 1]!, starts[i]!));
  }
  const days = await listDays(sub);
  const recent = days.slice(-60);
  const recentSymptomIds = recent.flatMap((d) => d.symptomIds);
  const bios = await listBiometrics(sub);
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
  return libraryArticles(market, "pcos").map((a) => ({
    id: a.id,
    title: a.title,
    markets: a.markets as Market[],
    summary: a.summary,
    body: a.body,
    reviewedAt: a.reviewedAt,
    outdated: a.outdated,
  }));
}
