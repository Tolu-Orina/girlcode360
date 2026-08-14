type AuthKind = "signin" | "signup" | "verify" | "reset" | "password" | "oauth";

function codeOf(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: string }).code);
  }
  return "";
}

export function isAuthConfigError(err: unknown): boolean {
  return err instanceof Error && /not configured/i.test(err.message);
}

export function mapAuthError(err: unknown, kind: AuthKind): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You are offline. Connect, then try again.";
  }
  if (isAuthConfigError(err)) {
    return "Sign-in is not configured on this build. Try again later.";
  }
  const code = codeOf(err);
  if (kind === "signin") {
    return "Incorrect email or password. Check both, then try again.";
  }
  if (kind === "signup") {
    if (code === "InvalidPasswordException") {
      return "Use at least 8 characters, with upper and lower case letters and a number.";
    }
    if (code === "UsernameExistsException") {
      return "If this email can be used, we sent a code. Check your inbox, or sign in.";
    }
    return "We could not create the account. Check the form, then try again.";
  }
  if (kind === "verify") {
    return "That code is not correct or has expired. Check the email, then try again.";
  }
  if (kind === "password") {
    if (code === "NotAuthorizedException") {
      return "Current password is not correct.";
    }
    if (code === "InvalidPasswordException") {
      return "Use at least 8 characters, with upper and lower case letters and a number.";
    }
    return "Could not update password. Check both fields, then try again.";
  }
  if (kind === "oauth") {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "google_denied") {
      return "Google sign-in was cancelled. You can try again, or use email.";
    }
    return "Google sign-in did not complete. Try again, or use email.";
  }
  return "That code is not correct or has expired. Request a new code, then try again.";
}
