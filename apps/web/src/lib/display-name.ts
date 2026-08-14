/**
 * Derive a first-person display name when the profile has no given name.
 * Pipeline: claims → email local-part → tokens → title case.
 */

export function emailLocalPart(email: string | undefined | null): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return null;
  return trimmed.slice(0, at);
}

export function splitNameTokens(local: string): string[] {
  return local
    .split(/[._+-]+/g)
    .map((token) => token.replace(/\d+$/g, ""))
    .filter((token) => token.length >= 2 && !/^\d+$/.test(token));
}

export function titleCaseWord(word: string): string {
  const lower = word.toLocaleLowerCase();
  if (!lower) return word;
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}

export function displayNameFromEmail(
  email: string | undefined | null,
): string | null {
  const local = emailLocalPart(email);
  if (!local) return null;
  const tokens = splitNameTokens(local);
  if (tokens.length > 0) return tokens.map(titleCaseWord).join(" ");
  return titleCaseWord(local.replace(/\d+/g, "")) || null;
}

export function firstNameFromDisplay(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function displayNameFromClaims(claims: {
  name?: string;
  given_name?: string;
  givenName?: string;
  email?: string;
}): string | null {
  const given = claims.given_name?.trim() || claims.givenName?.trim();
  if (given) return titleCaseWord(given);
  const full = claims.name?.trim();
  if (full) return firstNameFromDisplay(full);
  return displayNameFromEmail(claims.email);
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toLocaleUpperCase();
  }
  return name.trim().slice(0, 2).toLocaleUpperCase() || "G";
}
