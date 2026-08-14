/**
 * Device unlock for app open and sensitive wallet actions (APS-F-04 / FR-077).
 * WebAuthn platform authenticator when available; PIN fallback.
 */
const PIN_KEY = "gc360.lock.pinHash";
const CRED_KEY = "gc360.lock.webauthn";
const ENABLED_KEY = "gc360.lock.enabled";
const LEGACY_PIN = "gc360.wallet.pinHash";
const LEGACY_CRED = "gc360.wallet.webauthn";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function pinStorageKey(): string {
  if (localStorage.getItem(PIN_KEY)) return PIN_KEY;
  if (localStorage.getItem(LEGACY_PIN)) return LEGACY_PIN;
  return PIN_KEY;
}

function credStorageKey(): string {
  if (localStorage.getItem(CRED_KEY)) return CRED_KEY;
  if (localStorage.getItem(LEGACY_CRED)) return LEGACY_CRED;
  return CRED_KEY;
}

export function appLockEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

export function setAppLockEnabled(on: boolean): void {
  if (on) localStorage.setItem(ENABLED_KEY, "1");
  else localStorage.removeItem(ENABLED_KEY);
}

export function hasPin(): boolean {
  return Boolean(localStorage.getItem(PIN_KEY) || localStorage.getItem(LEGACY_PIN));
}

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(PIN_KEY, await sha256(pin));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(pinStorageKey());
  if (!stored) return false;
  return stored === (await sha256(pin));
}

export function webauthnAvailable(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function hasWebAuthn(): boolean {
  return Boolean(
    localStorage.getItem(CRED_KEY) || localStorage.getItem(LEGACY_CRED),
  );
}

export async function registerWebAuthn(): Promise<boolean> {
  if (!webauthnAvailable()) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "GirlCode360", id: window.location.hostname },
      user: {
        id: userId,
        name: "girlcode360",
        displayName: "GirlCode360",
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  localStorage.setItem(CRED_KEY, cred.id);
  return true;
}

export async function assertWebAuthn(): Promise<boolean> {
  if (!webauthnAvailable()) return false;
  const id = localStorage.getItem(credStorageKey());
  if (!id) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60_000,
        userVerification: "required",
        allowCredentials: [
          {
            id: Uint8Array.from(atob(id.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
              c.charCodeAt(0),
            ),
            type: "public-key",
          },
        ],
      },
    });
    return Boolean(cred);
  } catch {
    try {
      const cred = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60_000,
          userVerification: "required",
        },
      });
      return Boolean(cred);
    } catch {
      return false;
    }
  }
}

/**
 * Gate sensitive action: prefer WebAuthn, else PIN prompt via callback.
 */
export async function requireSensitiveUnlock(
  askPin: () => Promise<string | null>,
): Promise<boolean> {
  if (hasWebAuthn() && webauthnAvailable()) {
    const ok = await assertWebAuthn();
    if (ok) return true;
  }
  if (!hasPin()) {
    const pin = await askPin();
    if (!pin || pin.length < 4) return false;
    await setPin(pin);
    return true;
  }
  const pin = await askPin();
  if (!pin) return false;
  return verifyPin(pin);
}

export async function unlockWithPin(pin: string): Promise<boolean> {
  if (!hasPin()) {
    if (pin.length < 4) return false;
    await setPin(pin);
    return true;
  }
  return verifyPin(pin);
}
