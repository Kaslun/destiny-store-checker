import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service role bypasses RLS. Never import this into a client component.
// Lives behind `server-only` so a client import fails the build.
const url = process.env.SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function adminSupabase() {
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}
