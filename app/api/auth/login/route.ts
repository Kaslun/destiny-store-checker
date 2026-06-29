import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { authorizeUrl } from "@/lib/bungie";
import { setOAuthState } from "@/lib/session";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!rateLimit(clientKey(req, "auth"), 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const state = randomBytes(16).toString("hex");
  await setOAuthState(state);
  // Redirect URI is fixed in the Bungie app config — we do NOT pass a dynamic one.
  return NextResponse.redirect(authorizeUrl(state));
}
