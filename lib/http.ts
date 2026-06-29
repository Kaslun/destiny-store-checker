import { NextResponse } from "next/server";
import { getSession } from "./session";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export const unauthenticated = () => json({ error: "unauthenticated" }, 401);
export const needsReauth = () => json({ error: "needs_reauth" }, 409);

// Resolve the session user id or throw a Response to return directly.
export async function requireUser(): Promise<string> {
  const session = await getSession();
  if (!session) throw unauthenticated();
  return session.user_id;
}
