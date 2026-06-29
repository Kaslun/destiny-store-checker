-- Everywherse schema (data-engineer doc 01 §3).
-- Public catalog + rotation are world-readable; identity/secret/user tables
-- are reached only through the server's service-role client.

-- ── Public catalog (read by anyone, written by service role only) ──────────────

create table if not exists catalog_items (
  item_hash           bigint primary key,
  name                text not null,
  description         text,
  icon_url            text,
  screenshot_url      text,
  item_type           text,          -- emote, ghost, sparrow, ship, finisher, shader, ornament, bundle, engram
  item_subtype        text,
  collectible_hash    bigint,        -- null if the item has no collectible
  source_string       text,          -- e.g. "Source: Eververse"
  is_eververse        boolean not null default false,
  typical_currency    text,          -- 'silver' | 'bright_dust' | 'mixed' | null
  preview_item_hashes jsonb,         -- contents for bundles/engrams
  refundable          boolean,
  updated_at          timestamptz not null default now()
);

create table if not exists catalog_categories (
  id         text primary key,   -- presentation node hash or vendor category id (as text)
  parent_id  text references catalog_categories(id),
  name       text not null,
  sort_order int default 0,
  source     text not null       -- 'presentation_node' | 'vendor_category'
);

create table if not exists catalog_item_categories (
  item_hash   bigint references catalog_items(item_hash),
  category_id text references catalog_categories(id),
  primary key (item_hash, category_id)
);

create index if not exists catalog_items_eververse_idx on catalog_items (is_eververse);
create index if not exists catalog_item_categories_cat_idx on catalog_item_categories (category_id);

-- ── Live rotation (overwritten each poll) + append-only history ────────────────

create table if not exists current_rotation (
  id                 bigserial primary key,
  vendor_hash        bigint not null,
  item_hash          bigint not null references catalog_items(item_hash),
  category_id        text,
  currency_type      text not null,   -- 'silver' | 'bright_dust' | 'other'
  cost_currency_hash bigint,
  cost_amount        int,
  sale_status        text,            -- available | sold_out | locked
  quantity           int,
  reset_at           timestamptz,     -- vendor nextRefreshDate
  captured_at        timestamptz not null default now()
);

create index if not exists current_rotation_item_idx on current_rotation (item_hash);

create table if not exists rotation_snapshots (
  id            bigserial primary key,
  snapshot_date date not null,     -- the rotation day (UTC)
  vendor_hash   bigint not null,
  item_hash     bigint not null,
  currency_type text not null,
  cost_amount   int,
  sale_status   text,
  raw           jsonb,
  captured_at   timestamptz not null default now()
);

create index if not exists rotation_snapshots_item_date_idx on rotation_snapshots (item_hash, snapshot_date);
create unique index if not exists rotation_snapshots_unique_idx on rotation_snapshots (snapshot_date, vendor_hash, item_hash);

-- ── Identity and secrets (no anonymous access ever) ────────────────────────────

create table if not exists users (
  id                   uuid primary key default gen_random_uuid(),
  bungie_membership_id text unique not null,
  membership_type      int,
  display_name         text,
  created_at           timestamptz not null default now()
);

create table if not exists bungie_accounts (
  user_id            uuid primary key references users(id) on delete cascade,
  access_token_enc   text not null,   -- AES-256-GCM (iv:tag:ciphertext, base64)
  refresh_token_enc  text not null,
  access_expires_at  timestamptz not null,
  refresh_expires_at timestamptz not null,
  needs_reauth       boolean not null default false,
  updated_at         timestamptz not null default now()
);

create table if not exists system_credentials (
  key                text primary key,  -- e.g. 'service_account'
  refresh_token_enc  text not null,
  access_token_enc   text,
  access_expires_at  timestamptz,
  refresh_expires_at timestamptz,
  updated_at         timestamptz not null default now()
);

-- ── Resolved manifest constants the jobs + backend read ────────────────────────

create table if not exists config (
  key        text primary key,   -- 'manifest_version', 'eververse_vendor_hashes', 'bright_dust_hash', ...
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── User data (owner access only, enforced server-side via service role) ───────

create table if not exists wishlist (
  user_id    uuid references users(id) on delete cascade,
  item_hash  bigint references catalog_items(item_hash),
  notify     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, item_hash)
);

create table if not exists notification_prefs (
  user_id               uuid primary key references users(id) on delete cascade,
  email                 text,
  email_enabled         boolean not null default false,
  web_push_subscription jsonb,
  web_push_enabled      boolean not null default false
);

create table if not exists notifications (
  id            bigserial primary key,
  user_id       uuid references users(id) on delete cascade,
  item_hash     bigint,
  rotation_date date not null,
  channel       text not null,    -- 'email' | 'web_push'
  status        text not null,    -- 'sent' | 'failed'
  sent_at       timestamptz not null default now(),
  unique (user_id, item_hash, rotation_date, channel)
);
