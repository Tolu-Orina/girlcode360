import {
  countHealthLensReports,
  listHealthLensReportsForExport,
  purgeUserAi,
} from "./ai";
import { getBillingStatus, isPremium, purgeUserBilling } from "./billing";
import { isDsqlEnabled } from "../db/client";
import {
  deleteObject,
  exportObjectKey,
  getObject,
  isDataBucketEnabled,
  putObject,
} from "../db/s3";
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
import * as dsqlPrivacy from "./dsql/privacy";

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
  payloadUri?: string | null;
};

const deletions = new Map<string, DeletionRow>();
const exportsById = new Map<string, ExportRow & { userSub: string }>();

function addHoursIso(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

async function storeExportPayload(
  sub: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<{ payloadUri: string | null; payloadInline?: Record<string, unknown> }> {
  if (isDataBucketEnabled()) {
    const key = exportObjectKey(sub, id);
    await putObject(key, JSON.stringify(payload), "application/json");
    return { payloadUri: key };
  }
  return { payloadUri: null, payloadInline: payload };
}

async function loadExportPayload(
  job: { payloadUri?: string | null; payload?: Record<string, unknown> },
): Promise<Record<string, unknown> | undefined> {
  if (job.payload) return job.payload;
  if (job.payloadUri && isDataBucketEnabled()) {
    const buf = await getObject(job.payloadUri);
    if (!buf) return undefined;
    try {
      return JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return undefined;
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
  const stored = await storeExportPayload(sub, id, payload);
  const downloadHint = "GET /v1/privacy/export/" + id;

  if (isDsqlEnabled()) {
    await dsqlPrivacy.insertExportJob({
      id,
      userSub: sub,
      status: "ready",
      createdAt: now,
      readyAt: now,
      payloadUri: stored.payloadUri,
    });
    // When S3 unavailable, keep payload in memory keyed by id for this instance.
    if (stored.payloadInline) {
      exportsById.set(id, {
        id,
        userSub: sub,
        status: "ready",
        createdAt: now,
        readyAt: now,
        downloadHint,
        payload: stored.payloadInline,
        payloadUri: null,
      });
    }
    return {
      id,
      status: "ready" as const,
      createdAt: now,
      readyAt: now,
      downloadHint,
      payload,
    };
  }

  const job: ExportRow & { userSub: string } = {
    id,
    userSub: sub,
    status: "ready",
    createdAt: now,
    readyAt: now,
    downloadHint,
    payload: stored.payloadInline ?? payload,
    payloadUri: stored.payloadUri,
  };
  exportsById.set(id, job);
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    readyAt: job.readyAt,
    downloadHint: job.downloadHint,
    payload,
  };
}

export async function getExportJob(sub: string, id: string) {
  if (isDsqlEnabled()) {
    const job = await dsqlPrivacy.getExportJob(sub, id);
    if (!job) {
      const mem = exportsById.get(id);
      if (!mem || mem.userSub !== sub) return null;
      return {
        id: mem.id,
        status: mem.status,
        createdAt: mem.createdAt,
        readyAt: mem.readyAt,
        downloadHint: mem.downloadHint,
        payload: await loadExportPayload(mem),
      };
    }
    const mem = exportsById.get(id);
    const payload = await loadExportPayload({
      payloadUri: job.payloadUri,
      payload: mem?.payload,
    });
    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      readyAt: job.readyAt,
      downloadHint: "GET /v1/privacy/export/" + job.id,
      payload,
    };
  }
  const job = exportsById.get(id);
  if (!job || job.userSub !== sub) return null;
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    readyAt: job.readyAt,
    downloadHint: job.downloadHint,
    payload: await loadExportPayload(job),
  };
}

export async function getDeletion(sub: string): Promise<DeletionRow | null> {
  if (isDsqlEnabled()) {
    return (await dsqlPrivacy.getDeletion(sub)) ?? null;
  }
  return deletions.get(sub) ?? null;
}

export async function requestDeletion(sub: string) {
  const existing = await getDeletion(sub);
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
  if (isDsqlEnabled()) return dsqlPrivacy.upsertDeletion(sub, row);
  deletions.set(sub, row);
  return row;
}

export async function cancelDeletion(sub: string) {
  const row = await getDeletion(sub);
  if (!row || row.status !== "cooling_off") return null;
  const next: DeletionRow = {
    ...row,
    cancelledAt: new Date().toISOString(),
    status: "cancelled",
  };
  if (isDsqlEnabled()) return dsqlPrivacy.upsertDeletion(sub, next);
  deletions.set(sub, next);
  return next;
}

async function wipeUser(sub: string) {
  await purgeUserAi(sub);
  await purgeUserWallet(sub);
  await purgeUserJourney(sub);
  await purgeUserBilling(sub);
  await purgeUserMemory(sub);
  if (isDsqlEnabled()) {
    await dsqlPrivacy.deleteExportJobsForUser(sub);
  }
  for (const [id, job] of [...exportsById.entries()]) {
    if (job.userSub === sub) {
      if (job.payloadUri && isDataBucketEnabled()) {
        await deleteObject(job.payloadUri);
      }
      exportsById.delete(id);
    }
  }
}

/** Process cooling-off expiries (also callable from EventBridge later). */
export async function runDeletionPurge(now = Date.now()): Promise<number> {
  let n = 0;
  if (isDsqlEnabled()) {
    const due = await dsqlPrivacy.listDueDeletions(new Date(now).toISOString());
    for (const { userSub, row } of due) {
      await wipeUser(userSub);
      await dsqlPrivacy.upsertDeletion(userSub, {
        ...row,
        purgedAt: new Date().toISOString(),
        status: "purged",
      });
      n += 1;
    }
    return n;
  }
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
  const row = await getDeletion(sub);
  await wipeUser(sub);
  if (row) {
    const next: DeletionRow = {
      ...row,
      purgedAt: new Date().toISOString(),
      status: "purged",
    };
    if (isDsqlEnabled()) await dsqlPrivacy.upsertDeletion(sub, next);
    else deletions.set(sub, next);
  }
  return true;
}
