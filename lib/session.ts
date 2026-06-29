import "server-only";
import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";
import { createHash } from "node:crypto";

const COOKIE = "ew_session";
const STATE_COOKIE = "ew_oauth_state";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days, sliding

// Derive a 32-byte key from SESSION_SECRET for A256GCM.
function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new Uint8Array(createHash("sha256").update(s).digest());
}

const cookieOpts = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

export type SessionPayload = { user_id: string };

export async function createSession(userId: string): Promise<void> {
  const jwe = await new EncryptJWT({ user_id: userId })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .encrypt(secret());
  (await cookies()).set(COOKIE, jwe, { ...cookieOpts, maxAge: MAX_AGE });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, secret());
    if (typeof payload.user_id !== "string") return null;
    return { user_id: payload.user_id };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

// Short-lived state cookie for OAuth CSRF protection.
export async function setOAuthState(state: string): Promise<void> {
  (await cookies()).set(STATE_COOKIE, state, { ...cookieOpts, maxAge: 600 });
}

export async function readOAuthState(): Promise<string | undefined> {
  return (await cookies()).get(STATE_COOKIE)?.value;
}

export async function clearOAuthState(): Promise<void> {
  (await cookies()).delete(STATE_COOKIE);
}
