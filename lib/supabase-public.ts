import { createClient } from "@supabase/supabase-js";

// Anon key. Safe to expose because every private table denies anon (RLS).
// Used for public reads: catalog, rotation, history views.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function publicSupabase() {
  return createClient(url, anon, { auth: { persistSession: false } });
}
