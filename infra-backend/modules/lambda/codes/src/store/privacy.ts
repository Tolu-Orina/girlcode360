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

export function getMyData(sub: string) {
  const profile = getUser(sub);
  if (!profile) return null;
  return {
    profile,
    consents: latestConsentsByPurpose(sub),
    modules: profile.modules,
    counts: {
      cycles: listCycles(sub).length,
      cycleDays: listDays(sub).length,
      biometrics: listBiometrics(sub).length,
      medications: listMedications(sub).length,
      walletDocs: countWalletDocsAll(sub),
      pregnancyDays: listPregnancyDays(sub).length,
      ttcDays: listTtcDays(sub).length,
      healthLensReports: countHealthLensReports(sub),
    },
    premium: isPremium(sub),
    deletion: getDeletion(sub),
    exportedAt: new Date().toISOString(),
  };
}

export function buildExportPayload(sub: string): Record<string, unknown> {
  return {
    exportedAt: new Date().toISOString(),
    profile: getUser(sub),
    consents: listConsents(sub),
    cycles: listCycles(sub),
    cycleDays: listDays(sub),
    biometrics: listBiometrics(sub),
    medications: listMedications(sub),
    pregnancy: pregnancyStatus(sub),
    pregnancyDays: listPregnancyDays(sub),
    appointments: listAppointments(sub),
    ttc: ttcStatus(sub),
    ttcDays: listTtcDays(sub),
    notificationPrefs: getNotificationPrefs(sub),
    walletDocs: listWalletDocs(sub).map((d) => ({
      id: d.id,
      filename: d.filename,
      category: d.category,
      contentType: d.contentType,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt,
      // ciphertext omitted from JSON export summary — download via wallet
    })),
    healthLensReports: listHealthLensReportsForExport(sub),
    billing: getBillingStatus(sub),
  };
}

export function createExportJob(sub: string) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const payload = buildExportPayload(sub);
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

export function getExportJob(sub: string, id: string) {
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

export function getDeletion(sub: string): DeletionRow | null {
  return deletions.get(sub) ?? null;
}

export function requestDeletion(sub: string) {
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

export function cancelDeletion(sub: string) {
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

function wipeUser(sub: string) {
  purgeUserAi(sub);
  purgeUserWallet(sub);
  purgeUserJourney(sub);
  purgeUserBilling(sub);
  purgeUserMemory(sub);
  for (const [id, job] of [...exportsById.entries()]) {
    if (job.userSub === sub) exportsById.delete(id);
  }
}

/** Process cooling-off expiries (also callable from EventBridge later). */
export function runDeletionPurge(now = Date.now()): number {
  let n = 0;
  for (const [sub, row] of [...deletions.entries()]) {
    if (row.status !== "cooling_off") continue;
    if (Date.parse(row.purgeAfter) > now) continue;
    wipeUser(sub);
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
export function forcePurgeNow(sub: string) {
  const row = deletions.get(sub);
  wipeUser(sub);
  if (row) {
    deletions.set(sub, {
      ...row,
      purgedAt: new Date().toISOString(),
      status: "purged",
    });
  }
  return true;
}
