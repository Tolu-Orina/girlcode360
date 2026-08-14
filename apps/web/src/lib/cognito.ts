/**
 * Cognito auth client — amazon-cognito-identity-js only.
 * No Amplify. No Cognito Hosted UI.
 */
import {
  AuthenticationDetails,
  CognitoAccessToken,
  CognitoIdToken,
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { cognitoConfig } from "./config";

function getPool(): CognitoUserPool {
  if (!cognitoConfig.userPoolId || !cognitoConfig.clientId) {
    throw new Error(
      "Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID.",
    );
  }
  return new CognitoUserPool({
    UserPoolId: cognitoConfig.userPoolId,
    ClientId: cognitoConfig.clientId,
  });
}

export function signUp(email: string, password: string): Promise<void> {
  const pool = getPool();
  const attributeList = [
    new CognitoUserAttribute({ Name: "email", Value: email }),
  ];
  return new Promise((resolve, reject) => {
    pool.signUp(email, password, attributeList, [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: getPool() });
  return new Promise((resolve, reject) => {
    user.confirmRegistration(code, true, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  const user = new CognitoUser({ Username: email, Pool: getPool() });
  const auth = new AuthenticationDetails({
    Username: email,
    Password: password,
  });
  return new Promise((resolve, reject) => {
    user.authenticateUser(auth, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    });
  });
}

export function forgotPassword(email: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: getPool() });
  return new Promise((resolve, reject) => {
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
      inputVerificationCode: () => resolve(),
    });
  });
}

export function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: getPool() });
  return new Promise((resolve, reject) => {
    user.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  const pool = getPool();
  const user = pool.getCurrentUser();
  if (!user) return Promise.reject(new Error("not_authenticated"));
  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }
      user.changePassword(oldPassword, newPassword, (changeErr) => {
        if (changeErr) reject(changeErr);
        else resolve();
      });
    });
  });
}

export function signOut(): void {
  const pool = getPool();
  const user = pool.getCurrentUser();
  user?.signOut();
}

export function getCurrentSession(): Promise<CognitoUserSession | null> {
  const pool = getPool();
  const user = pool.getCurrentUser();
  if (!user) return Promise.resolve(null);
  return new Promise((resolve) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) resolve(null);
      else resolve(session);
    });
  });
}

const OAUTH_STATE_KEY = "gc360.oauth.state";
const OAUTH_VERIFIER_KEY = "gc360.oauth.verifier";

function oauthRedirectUri(): string {
  return `${window.location.origin}/oauth/callback`;
}

function oauthBase(): string {
  const domain = cognitoConfig.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${domain}`;
}

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return b64url(new Uint8Array(digest));
}

export function googleSignInAvailable(): boolean {
  return Boolean(
    cognitoConfig.googleIdp &&
      cognitoConfig.domain &&
      cognitoConfig.clientId &&
      cognitoConfig.userPoolId,
  );
}

/** Redirect to Google via Cognito authorize (skips managed-login form). */
export async function startGoogleSignIn(): Promise<void> {
  if (!googleSignInAvailable()) {
    throw new Error("Google sign-in is not configured on this build.");
  }
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(OAUTH_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  const challenge = await pkceChallenge(verifier);
  const url = new URL(`${oauthBase()}/oauth2/authorize`);
  url.searchParams.set("identity_provider", "Google");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cognitoConfig.clientId);
  url.searchParams.set("redirect_uri", oauthRedirectUri());
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("state", state);
  window.location.assign(url.toString());
}

export async function completeGoogleSignIn(params: URLSearchParams): Promise<void> {
  if (!googleCompleteInflight) {
    googleCompleteInflight = exchangeGoogleCode(params).finally(() => {
      googleCompleteInflight = null;
    });
  }
  return googleCompleteInflight;
}

let googleCompleteInflight: Promise<void> | null = null;

async function exchangeGoogleCode(params: URLSearchParams): Promise<void> {
  const err = params.get("error");
  if (err) {
    throw new Error(err === "access_denied" ? "google_denied" : "google_failed");
  }
  const code = params.get("code");
  const state = params.get("state");
  const expected = sessionStorage.getItem(OAUTH_STATE_KEY);
  const verifier = sessionStorage.getItem(OAUTH_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_VERIFIER_KEY);
  if (!code || !state || !expected || state !== expected || !verifier) {
    throw new Error("google_failed");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cognitoConfig.clientId,
    code,
    redirect_uri: oauthRedirectUri(),
    code_verifier: verifier,
  });
  const res = await fetch(`${oauthBase()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("google_failed");
  const tokens = (await res.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };
  if (!tokens.id_token || !tokens.access_token) throw new Error("google_failed");
  const IdToken = new CognitoIdToken({ IdToken: tokens.id_token });
  const AccessToken = new CognitoAccessToken({ AccessToken: tokens.access_token });
  const RefreshToken = new CognitoRefreshToken({
    RefreshToken: tokens.refresh_token ?? "",
  });
  const session = new CognitoUserSession({ IdToken, AccessToken, RefreshToken });
  const payload = IdToken.decodePayload() as { sub?: string; "cognito:username"?: string };
  const username = payload["cognito:username"] || payload.sub;
  if (!username) throw new Error("google_failed");
  const user = new CognitoUser({ Username: username, Pool: getPool() });
  user.setSignInUserSession(session);
}
