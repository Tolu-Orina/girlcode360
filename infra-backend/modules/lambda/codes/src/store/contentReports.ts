import {
  libraryArticleById,
  stripReportLinks,
} from "../../../../../../packages/domain/src/index";
import { isDsqlEnabled } from "../db/client";
import * as dsql from "./dsql/contentReports";
import { postExists } from "./community";

export type ContentReportTargetType = "article" | "post" | "listing" | "review";
export type ContentReportReason =
  | "inaccurate"
  | "harmful"
  | "spam"
  | "privacy"
  | "other";
export type ContentReportStatus = "open" | "reviewed" | "dismissed";

export type ContentReport = {
  id: string;
  reporterSub: string;
  targetType: ContentReportTargetType;
  targetId: string;
  reason: ContentReportReason;
  details: string;
  status: ContentReportStatus;
  createdAt: string;
};

const REASONS = new Set<ContentReportReason>([
  "inaccurate",
  "harmful",
  "spam",
  "privacy",
  "other",
]);
const TARGETS = new Set<ContentReportTargetType>([
  "article",
  "post",
  "listing",
  "review",
]);
const STATUSES = new Set<ContentReportStatus>(["open", "reviewed", "dismissed"]);

const mem = new Map<string, ContentReport>();

export function isReportReason(v: string): v is ContentReportReason {
  return REASONS.has(v as ContentReportReason);
}

export function isReportTarget(v: string): v is ContentReportTargetType {
  return TARGETS.has(v as ContentReportTargetType);
}

export function isReportStatus(v: string): v is ContentReportStatus {
  return STATUSES.has(v as ContentReportStatus);
}

export async function createContentReport(input: {
  reporterSub: string;
  targetType: ContentReportTargetType;
  targetId: string;
  reason: ContentReportReason;
  details?: string;
}): Promise<{ ok: true; report: ContentReport } | { ok: false; error: string }> {
  const targetId = input.targetId.trim();
  if (!targetId) return { ok: false, error: "target_id_required" };
  if (input.targetType === "article" && !libraryArticleById(targetId)) {
    return { ok: false, error: "unknown_article" };
  }
  if (input.targetType === "post" && !(await postExists(targetId))) {
    return { ok: false, error: "unknown_post" };
  }
  const report: ContentReport = {
    id: crypto.randomUUID(),
    reporterSub: input.reporterSub,
    targetType: input.targetType,
    targetId,
    reason: input.reason,
    details: stripReportLinks((input.details ?? "").trim()),
    status: "open",
    createdAt: new Date().toISOString(),
  };
  if (isDsqlEnabled()) {
    await dsql.insertReport(report);
  } else {
    mem.set(report.id, report);
  }
  return { ok: true, report };
}

export async function listMyReports(sub: string): Promise<ContentReport[]> {
  if (isDsqlEnabled()) return dsql.listMine(sub);
  return [...mem.values()]
    .filter((r) => r.reporterSub === sub)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countMyReports(sub: string): Promise<number> {
  if (isDsqlEnabled()) return dsql.countMine(sub);
  return [...mem.values()].filter((r) => r.reporterSub === sub).length;
}

export async function listModerationQueue(
  status?: ContentReportStatus,
): Promise<ContentReport[]> {
  if (isDsqlEnabled()) return dsql.listQueue(status);
  return [...mem.values()]
    .filter((r) => (status ? r.status === status : true))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function patchReportStatus(
  id: string,
  status: ContentReportStatus,
): Promise<ContentReport | null> {
  if (isDsqlEnabled()) return dsql.patchStatus(id, status);
  const row = mem.get(id);
  if (!row) return null;
  const next = { ...row, status };
  mem.set(id, next);
  return next;
}

export async function purgeUserReports(sub: string): Promise<void> {
  if (isDsqlEnabled()) await dsql.purgeUserReports(sub);
  for (const [id, row] of [...mem.entries()]) {
    if (row.reporterSub === sub) mem.delete(id);
  }
}
