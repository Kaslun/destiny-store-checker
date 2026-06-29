# Everywherse

A Destiny 2 Eververse rotation tracker and wishlist. Shows the live rotation, lets people browse the full Eververse catalog, star what they want, and get notified when a starred item appears. Logged-in users see what they own and can afford. No purchasing (the API doesn't allow it); the value the product owns is **rotation history over time**.

Built from the handover set. Renamed from the working name "Brightwatch" to **Everywherse**.

## Stack

Next.js 15 (App Router) on Vercel · Supabase Postgres with RLS · GitHub Actions for scheduled jobs · Bungie confidential OAuth · Resend (email) · web-push (VAPID).

## The load-bearing constraints

1. No purchasing through the API. Everywherse is read-and-notify only; "buy" hands off into the game.
2. Eververse isn't in the public vendor endpoint, so a service account polls the rotation on a schedule.
3. No Bungie token, client secret, API key, or service-role key ever reaches the browser. The session cookie carries only an internal `user_id`.

## Layout

```
app/                    Next.js App Router
  page.tsx              / store (today's rotation)
  catalog/              /catalog browse
  wishlist/             /wishlist (auth)
  item/[hash]/          item detail + history
  account/              login, notifications, delete
  api/                  auth, me, wishlist, notifications, account routes
components/             ItemCard, RotationTabs, CurrencyFilter, ResetCountdown,
                        WishlistStar, LiveBanner, OwnedBadge, AffordChip,
                        CadenceSparkline, EmptyState, ReconnectPrompt, OverlayProvider
lib/                    crypto, supabase clients, bungie OAuth, session, tokens,
                        collectibles overlay, notify dispatch, data reads, types
supabase/migrations/    0001 schema · 0002 RLS · 0003 history views
jobs/                   manifest_ingest.py · poll_rotation.py (Python) ·
                        notify-dispatch.ts (Node) · lib/ shared
.github/workflows/      manifest-ingest · poll-rotation · notify-dispatch · ci
scripts/                check-client-bundle.mjs (secret-leak gate)
tests/                  crypto roundtrip · notify dispatch dedupe
```

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in. Generate keys:
   - `TOKEN_ENC_KEY`: `openssl rand -base64 32`
   - `SESSION_SECRET`: `openssl rand -base64 32`
   - VAPID pair: `npx web-push generate-vapid-keys`
3. Apply migrations to your Supabase project (SQL editor or the Supabase CLI, in order).
4. Register a **confidential** Bungie OAuth client (scopes `ReadBasicUserProfile`, `ReadDestinyInventoryAndVault`). Redirect URI is fixed per environment; dev uses `https://127.0.0.1:3000/api/auth/callback` (Bungie rejects `localhost`).
5. Authorize a **service account** once and store its encrypted refresh token in `system_credentials` (key `service_account`). The poll job uses it.
6. `npm run dev`

## Scripts

- `npm run dev` / `build` / `start`
- `npm run typecheck` — `tsc --noEmit`
- `npm run test` — vitest (crypto + notify)
- `npm run check:secrets` — fails if any server-only secret reaches `.next/static` (run after `build`)
- `npm run job:notify` — runs the notification dispatch

## Security model

Public tables (`catalog_*`, `current_rotation`, `rotation_snapshots`) allow anonymous `SELECT` only. Every private table has RLS enabled with **zero policies**, so the anon key gets nothing; the server reaches them with the service role, which bypasses RLS. Tokens are AES-256-GCM encrypted at rest and never logged decrypted, never returned to the client, never placed in the session. The CI `check:secrets` gate greps the built client bundle for server-only secret names and values.

## Notes

- Unofficial companion tool. Not affiliated with or endorsed by Bungie. Item data and imagery are Bungie's.
- The Python jobs and the manifest hash resolution are faithful skeletons: Eververse vendor hashes, Bright Dust hash, and the presentation-node roots are resolved by name at ingest time, never hardcoded. The presentation-node subtree walk (doc 01 §5.4) is a documented TODO in `manifest_ingest.py`.
- Reset cron times (~17:00 UTC daily, Tuesday weekly) should be verified against current Bungie timing rather than trusted indefinitely.
