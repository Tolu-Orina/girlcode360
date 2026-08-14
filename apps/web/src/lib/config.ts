/** Cognito config — injected at build time from SSM in CI; local defaults for Phase 0 */
export const cognitoConfig = {
  region: import.meta.env.VITE_COGNITO_REGION ?? "eu-west-2",
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "",
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? "",
  domain: import.meta.env.VITE_COGNITO_DOMAIN ?? "",
  googleIdp: import.meta.env.VITE_COGNITO_GOOGLE_IDP === "true",
};

export const localYoucam = import.meta.env.VITE_LOCAL_YOUCAM === "true";

export const apiBaseUrl = localYoucam
  ? (import.meta.env.VITE_API_BASE_URL || "http://localhost:5173")
  : (import.meta.env.VITE_API_BASE_URL ?? "");

/** Same-origin in `vite` so YOUCAM_API_KEY can ride the proxy, not the bundle. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.DEV && apiBaseUrl) return p;
  return `${apiBaseUrl.replace(/\/$/, "")}${p}`;
}
