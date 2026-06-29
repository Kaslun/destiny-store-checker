#!/usr/bin/env node
// Greps the built client bundle for any server-only secret NAME or VALUE.
// Run after `next build`. Exits non-zero on any hit (CI gate).
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const CLIENT_DIR = ".next/static";
const SERVER_ONLY_NAMES = [
  "BUNGIE_CLIENT_SECRET", "BUNGIE_API_KEY", "TOKEN_ENC_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", "SESSION_SECRET", "RESEND_API_KEY",
  "VAPID_PRIVATE_KEY",
];
// Values present at build time that must never be inlined.
const SERVER_ONLY_VALUES = SERVER_ONLY_NAMES
  .map((n) => process.env[n])
  .filter((v) => typeof v === "string" && v.length >= 8);

if (!existsSync(CLIENT_DIR)) {
  console.error(`No ${CLIENT_DIR}; run \`next build\` first.`);
  process.exit(2);
}

function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(js|mjs|css|map)$/.test(e)) yield p;
  }
}

const hits = [];
for (const file of walk(CLIENT_DIR)) {
  const text = readFileSync(file, "utf8");
  for (const name of SERVER_ONLY_NAMES) if (text.includes(name)) hits.push(`${name} (name) in ${file}`);
  for (const val of SERVER_ONLY_VALUES) if (text.includes(val)) hits.push(`a secret value in ${file}`);
}

if (hits.length) {
  console.error("SECRET LEAK — server-only material found in client bundle:");
  for (const h of hits) console.error("  - " + h);
  process.exit(1);
}
console.log("OK: no server-only secret names/values in the client bundle.");
