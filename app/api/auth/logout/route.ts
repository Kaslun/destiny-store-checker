import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export const runtime = "nodejs";

// Logout clears the session cookie. Stored tokens are kept so notifications
// keep working; full disconnect is the "delete account" action. (doc 02 §4)
export async function POST() {
  await destroySession();
  return new NextResponse(null, { status: 204 });
}
