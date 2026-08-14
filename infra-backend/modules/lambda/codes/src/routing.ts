import type { APIGatewayProxyEvent } from "aws-lambda";

export function pathOf(event: APIGatewayProxyEvent): string {
  const p = event.path ?? "";
  const idx = p.indexOf("/v1");
  return idx >= 0 ? p.slice(idx) : p;
}

/** True for `/v1/foo` and `/v1/foo/...`, never `/v1/foobar`. */
export function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** EventBridge payload used by notify-tick, healthlens-monthly, and purge. */
export function schedulerKind(event: unknown): string | undefined {
  if (!event || typeof event !== "object") return undefined;
  const scheduled = event as { source?: string; detail?: { kind?: string } };
  if (scheduled.source !== "girlcode360.scheduler") return undefined;
  return scheduled.detail?.kind;
}
