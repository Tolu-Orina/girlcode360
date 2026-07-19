/**
 * Cognito auth client — amazon-cognito-identity-js only.
 * No Amplify. No Cognito Hosted UI.
 */
import {
  AuthenticationDetails,
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
