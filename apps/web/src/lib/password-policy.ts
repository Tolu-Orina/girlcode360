/** Cognito password policy (infra-backend/modules/cognito/main.tf). */
export function passwordPolicyError(password: string): string | null {
  if (password.length < 8) {
    return "Use at least 8 characters, with upper and lower case letters and a number.";
  }
  if (!/[a-z]/.test(password)) return "Include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Include a number.";
  return null;
}

export const PASSWORD_HINT =
  "At least 8 characters, with upper and lower case letters and a number.";
