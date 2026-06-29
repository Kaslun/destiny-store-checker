# Deploying Everywherse to Vercel

The repo is connected to Vercel. Vercel auto-detects Next.js — no build config needed
(build `next build`, output handled automatically). It will build green even before any
env vars are set, because the Supabase/Bungie clients initialize lazily at request time.
The site only becomes *functional* once the steps below are done.

## 1. External services (do these first — they produce the secret values)

- **Supabase**: create a project, then run the three files in `supabase/migrations/` in order
  (SQL editor or `supabase db push`). Grab the project URL, the anon key, and the
  service-role key. Enable point-in-time recovery — the snapshot history is irreplaceable.
- **Bungie**: register a *confidential* OAuth client at
  https://www.bungie.net/en/Application. Scopes `ReadBasicUserProfile` and
  `ReadDestinyInventoryAndVault`. Redirect URL is fixed per app and must be your Vercel
  production callback: `https://<your-domain>/api/auth/callback`. Capture client id,
  client secret, and API key.
- **Service account**: a second Bungie account with a character that reached the Tower.
  Authorize it once through the OAuth flow, then store its refresh token encrypted in
  `system_credentials` (key `service_account`). The poll job uses it.
- **Resend**: API key + a verified from-address. **VAPID**: `npx web-push generate-vapid-keys`.
- Generate `TOKEN_ENC_KEY` and `SESSION_SECRET`: each `openssl rand -base64 32`.
  Back up `TOKEN_ENC_KEY` separately — losing it makes every stored token undecryptable.

## 2. Vercel environment variables

Vercel → Project → Settings → Environment Variables. Set these for **Production** (and a
parallel set for **Preview** with their own values — never share secrets across them).

Server-only (no prefix — these must never reach the browser):

```
BUNGIE_CLIENT_ID
BUNGIE_CLIENT_SECRET
BUNGIE_API_KEY
TOKEN_ENC_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SESSION_SECRET
RESEND_API_KEY
NOTIFY_FROM_EMAIL
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
APP_URL                      # = your production https origin, e.g. https://everywherse.vercel.app
```

Client-readable (the `NEXT_PUBLIC_` prefix inlines them into the bundle — only these three):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY # same value as VAPID_PUBLIC_KEY
```

Rule: if a value would let someone act as the app or a user, it stays server-only. The CI
`check:secrets` gate fails the build if any server-only name or value lands in the client bundle.

## 3. Scheduled jobs run on GitHub Actions, not Vercel

Vercel Cron is intentionally **not** used (doc 05): the manifest ingest, rotation poll, and
notify dispatch are heavy/long and run as GitHub Actions. Set their secrets in
GitHub → repo → Settings → Secrets and variables → Actions:

```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUNGIE_API_KEY, BUNGIE_CLIENT_ID,
BUNGIE_CLIENT_SECRET, TOKEN_ENC_KEY, RESEND_API_KEY, NOTIFY_FROM_EMAIL,
VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
SERVICE_MEMBERSHIP_TYPE, SERVICE_MEMBERSHIP_ID, SERVICE_CHARACTER_ID
```

Run `manifest-ingest` once manually (workflow_dispatch) so the catalog is populated before
the first poll. Verify the reset cron times (~17:00 UTC daily, Tuesday weekly) against
current Bungie timing.

## 4. Preview deployments and OAuth

Bungie's redirect URL is fixed per app, so OAuth only works on the origin you registered.
Preview deploys get rotating URLs and won't complete login unless you register a stable
preview domain (or a second Bungie app) and point that environment's `APP_URL` at it. The
logged-out store and catalog work on any deploy without Bungie credentials.

## 5. After the first deploy

- Confirm the deployed site loads (store/catalog render from public Supabase reads).
- Run the security smoke test: with only the anon key, `select` from `bungie_accounts` and
  `wishlist` must return nothing; `current_rotation` must be readable but not writable.
- Log in via Bungie end-to-end, then inspect the page source / network — no Bungie token
  anywhere client-side.
