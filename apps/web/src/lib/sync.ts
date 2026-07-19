/**
 * SyncManager — drains IndexedDB outbox to POST /v1/cycles/sync
 * with Idempotency-Key (one key per outbox item, batched).
 */
import type { Cycle, CycleDay, PredictionResponse, SyncOp } from "../../../../packages/api-types/src/index";
import { syncCycles } from "./api";
import {
  idbEnqueue,
  idbGetAllCycles,
  idbGetAllDays,
  idbGetMeta,
  idbMarkOutbox,
  idbPendingOutbox,
  idbPutCycle,
  idbPutDay,
  idbReplaceCycles,
  idbReplaceDays,
  idbSetMeta,
} from "./idb";
import {
  predictNextPeriods,
  predictedPeriodDates,
} from "../../../../packages/domain/src/index";

export type CycleState = {
  cycles: Cycle[];
  days: CycleDay[];
  prediction: PredictionResponse;
  pendingCount: number;
  online: boolean;
};

function localPrediction(cycles: Cycle[]): PredictionResponse {
  const override =
    [...cycles].reverse().find((c) => c.cycleLengthOverride != null)
      ?.cycleLengthOverride ?? null;
  const result = predictNextPeriods(
    cycles.map((c) => ({ startDate: c.startDate, endDate: c.endDate })),
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
  return {
    ...result,
    predictedDates: result.nextStarts.flatMap((s) =>
      predictedPeriodDates(s, result.periodLengthDays),
    ),
    enoughData: true,
  };
}

export async function loadLocalState(): Promise<CycleState> {
  const cycles = await idbGetAllCycles<Cycle>();
  const days = await idbGetAllDays<CycleDay>();
  const pending = await idbPendingOutbox();
  const cached = await idbGetMeta<PredictionResponse>("prediction");
  return {
    cycles: cycles.sort((a, b) => a.startDate.localeCompare(b.startDate)),
    days: days.sort((a, b) => a.date.localeCompare(b.date)),
    prediction: cached ?? localPrediction(cycles),
    pendingCount: pending.length,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
  };
}

export async function enqueueAndStore(op: SyncOp): Promise<CycleState> {
  if (op.op === "upsert_cycle") {
    const now = new Date().toISOString();
    const cycle: Cycle = {
      id: op.cycle.id ?? crypto.randomUUID(),
      startDate: op.cycle.startDate,
      endDate: op.cycle.endDate ?? null,
      cycleLengthOverride: op.cycle.cycleLengthOverride ?? null,
      createdAt: now,
      updatedAt: now,
    };
    op.cycle.id = cycle.id;
    await idbPutCycle(cycle);
  } else if (op.op === "patch_cycle") {
    const cycles = await idbGetAllCycles<Cycle>();
    const cur = cycles.find((c) => c.id === op.id);
    if (cur) {
      await idbPutCycle({
        ...cur,
        ...op.patch,
        updatedAt: new Date().toISOString(),
      });
    }
  } else if (op.op === "delete_cycle") {
    const cycles = await idbGetAllCycles<Cycle>();
    await idbReplaceCycles(cycles.filter((c) => c.id !== op.id));
  } else if (op.op === "upsert_day") {
    const existing = (await idbGetAllDays<CycleDay>()).find(
      (d) => d.date === op.day.date,
    );
    const day: CycleDay = {
      date: op.day.date,
      flow: op.day.flow ?? existing?.flow ?? "none",
      mood: op.day.mood !== undefined ? op.day.mood : (existing?.mood ?? null),
      symptomIds: op.day.symptomIds ?? existing?.symptomIds ?? [],
      note: op.day.note !== undefined ? op.day.note : (existing?.note ?? null),
      updatedAt: new Date().toISOString(),
    };
    await idbPutDay(day);
  }

  await idbEnqueue(op);
  const state = await loadLocalState();
  const prediction = localPrediction(state.cycles);
  await idbSetMeta("prediction", prediction);
  void flushOutbox();
  return { ...state, prediction };
}

let flushing = false;

export async function flushOutbox(): Promise<CycleState | null> {
  if (flushing) return null;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return loadLocalState();
  }
  flushing = true;
  try {
    const pending = await idbPendingOutbox();
    if (pending.length === 0) return loadLocalState();

    // Batch under the first item's idempotency key for this flush window
    const batchKey = pending.map((p) => p.idempotencyKey).join(":");
    const ops = pending.map((p) => p.op as SyncOp);
    for (const p of pending) await idbMarkOutbox(p.id, "syncing");

    try {
      const res = await syncCycles(ops, batchKey);
      await idbReplaceCycles(res.cycles);
      await idbReplaceDays(res.days);
      await idbSetMeta("prediction", res.prediction);
      for (const p of pending) await idbMarkOutbox(p.id, "done");
    } catch {
      for (const p of pending) await idbMarkOutbox(p.id, "error", "sync_failed");
    }
    return loadLocalState();
  } finally {
    flushing = false;
  }
}

export async function hydrateFromServer(
  snapshot: {
    cycles: Cycle[];
    days: CycleDay[];
    prediction: PredictionResponse;
  },
): Promise<CycleState> {
  await idbReplaceCycles(snapshot.cycles);
  await idbReplaceDays(snapshot.days);
  await idbSetMeta("prediction", snapshot.prediction);
  return loadLocalState();
}
