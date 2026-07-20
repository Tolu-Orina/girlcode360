import {
  predictNextPeriods,
  predictedPeriodDates,
} from "../../../../../../packages/domain/src/index";
import { listCycles } from "../store/memory";
import type { Cycle, PredictionResponse } from "../types";

export async function buildPrediction(sub: string): Promise<PredictionResponse> {
  const cycles = await listCycles(sub);
  const override =
    [...cycles].reverse().find((c) => c.cycleLengthOverride != null)
      ?.cycleLengthOverride ?? null;

  const result = predictNextPeriods(
    cycles.map((c: Cycle) => ({
      startDate: c.startDate,
      endDate: c.endDate,
    })),
    { cycleLengthOverride: override },
  );

  if (!result) {
    return {
      cycleLengthDays: 28,
      periodLengthDays: 5,
      nextStarts: [],
      confidenceBandDays: 0,
      highVariance: false,
      message:
        "Log at least two periods to see predictions. Estimates are wellness guidance, not medical advice.",
      predictedDates: [],
      enoughData: false,
    };
  }

  const predictedDates = result.nextStarts.flatMap((start) =>
    predictedPeriodDates(start, result.periodLengthDays),
  );

  return { ...result, predictedDates, enoughData: true };
}
