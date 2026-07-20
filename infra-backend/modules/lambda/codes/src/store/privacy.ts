import {
  countHealthLensReports,
  listHealthLensReportsForExport,
  purgeUserAi,
} from "./ai";
import { getBillingStatus, isPremium, purgeUserBilling } from "./billing";
import {
  listBiometrics,
  listConsents,
  listCycles,
  listDays,
  listMedications,
  getUser,
  latestConsentsByPurpose,
  purgeUserMemory,
} from "./memory";
import {
  listAppointments,
  listPregnancyDays,
  listTtcDays,
  purgeUserJourney,
  getNotificationPrefs,
  pregnancyStatus,
  ttcStatus,
} from "./journey";
import { countWalletDocsAll, listWalletDocs, purgeUserWallet } from "./wallet";

const COOLING_OFF_MS = 24 * 60 * 60 * 1000;

type DeletionRow = {
  id: string;
  requestedAt: string;
  purgeAfter: string;
  cancelledAt: string | null;
  purgedAt: string | null;
  status: "cooling_off" | "cancelled" | "purged";
};

type ExportRow = {
  id: string;
  status: "pending" | "ready" | "failed";
  createdAt: string;
  readyAt: string | null;
  downloadHint: string;
  payload?: Record<string, unknown>;
};

const deletions = new Map<string, DeletionRow>();
const exportsById = new Map<string, ExportRow & { userSub: string }>();

function addHoursIso(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export async function getMyData(sub: string) {
  const profile = await getUser(sub);
  if (!profile) return null;
  return {
    profile,
    consents: await latestConsentsByPurpose(sub),
    modules: profile.modules,
    counts: {
      cycles: (await listCycles(sub)).length,
      cycleDays: (await listDays(sub)).length,
      biometrics: (await listBiometrics(sub)).length,
      medications: (await listMedications(sub)).length,
      walletDocs: await countWalletDocsAll(sub),
      pregnancyDays: (await listPregnancyDays(sub)).length,
      ttcDays: (await listTtcDays(sub)).length,
      healthLensReports: await countHealthLensReports(sub),
    },
    premium: await isPremium(sub),
    deletion: await getDeletion(sub),
    exportedAt: new Date().toISOString(),
  };
}

export async function buildExportPayload(
  sub: string,
): Promise<Record<string, unknown>> {
  return {
    exportedAt: new Date().toISOString(),
    profile: await getUser(sub),
    consents: await listConsents(sub),
    cycles: await listCycles(sub),
    cycleDays: await listDays(sub),
    biometrics: await listBiometrics(sub),
    medications: await listMedications(sub),
    pregnancy: await pregnancyStatus(sub),
    pregnancyDays: await listPregnancyDays(sub),
    appointments: await listAppointments(sub),
    ttc: await ttcStatus(sub),
    ttcDays: await listTtcDays(sub),
    notificationPrefs: await getNotificationPrefs(sub),
    walletDocs: (await listWalletDocs(sub)).map((d) => ({
      id: d.id,
      filename: d.filename,
      category: d.category,
      contentType: d.contentType,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt,
    })),
    healthLensReports: await listHealthLensReportsForExport(sub),
    billing: await getBillingStatus(sub),
  };
}

export async function createExportJob(sub: string) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const payload = await buildExportPayload(sub);
  const job: ExportRow & { userSub: string } = {
    id,
    userSub: sub,
    status: "ready",
    createdAt: now,
    readyAt: now,
    downloadHint: "GET /v1/privacy/export/" + id,
    payload,
  };
  exportsById.set(id, job);
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    readyAt: job.readyAt,
    downloadHint: job.downloadHint,
    payload: job.payload,
  };
}

export async function getExportJob(sub: string, id: string) {
  const job = exportsById.get(id);
  if (!job || job.userSub !== sub) return null;
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    readyAt: job.readyAt,
    downloadHint: job.downloadHint,
    payload: job.payload,
  };
}

export async function getDeletion(sub: string): Promise<DeletionRow | null> {
  return deletions.get(sub) ?? null;
}

export async function requestDeletion(sub: string) {
  const existing = deletions.get(sub);
  if (existing?.status === "cooling_off") return existing;
  const now = new Date().toISOString();
  const row: DeletionRow = {
    id: crypto.randomUUID(),
    requestedAt: now,
    purgeAfter: addHoursIso(COOLING_OFF_MS),
    cancelledAt: null,
    purgedAt: null,
    status: "cooling_off",
  };
  deletions.set(sub, row);
  return row;
}

export async function cancelDeletion(sub: string) {
  const row = deletions.get(sub);
  if (!row || row.status !== "cooling_off") return null;
  const next: DeletionRow = {
    ...row,
    cancelledAt: new Date().toISOString(),
    status: "cancelled",
  };
  deletions.set(sub, next);
  return next;
}

async function wipeUser(sub: string) {
  await purgeUserAi(sub);
  await purgeUserWallet(sub);
  await purgeUserJourney(sub);
  await purgeUserBilling(sub);
  await purgeUserMemory(sub);
  for (const [id, job] of [...exportsById.entries()]) {
    if (job.userSub === sub) exportsById.delete(id);
  }
}

/** Process cooling-off expiries (also callable from EventBridge later). */
export async function runDeletionPurge(now = Date.now()): Promise<number> {
  let n = 0;
  for (const [sub, row] of [...deletions.entries()]) {
    if (row.status !== "cooling_off") continue;
    if (Date.parse(row.purgeAfter) > now) continue;
    await wipeUser(sub);
    deletions.set(sub, {
      ...row,
      purgedAt: new Date().toISOString(),
      status: "purged",
    });
    n += 1;
  }
  return n;
}

/** Dev helper: force purge now (skips remaining cooling-off). */
export async function forcePurgeNow(sub: string) {
  const row = deletions.get(sub);
  await wipeUser(sub);
  if (row) {
    deletions.set(sub, {
      ...row,
      purgedAt: new Date().toISOString(),
      status: "purged",
    });
  }
  return true;
}
