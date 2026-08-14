/** Cognito config — injected at build time from SSM in CI; local defaults for Phase 0 */
export const cognitoConfig = {
  region: import.meta.env.VITE_COGNITO_REGION ?? "eu-west-2",
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "",
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? "",
  domain: import.meta.env.VITE_COGNITO_DOMAIN ?? "",
  googleIdp: import.meta.env.VITE_COGNITO_GOOGLE_IDP === "true",
};

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
