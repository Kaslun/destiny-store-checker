-- Everywherse RLS (data-engineer doc 01 §4).
-- Model: public tables allow anonymous SELECT only; private tables enable RLS
-- with ZERO policies so anon/authenticated get nothing. The server uses the
-- service role (which bypasses RLS) for all private access. There is no
-- Supabase Auth user, so no policy references auth.uid().

-- ── Public read on catalog + rotation ──────────────────────────────────────────
alter table catalog_items           enable row level security;
alter table catalog_categories      enable row level security;
alter table catalog_item_categories enable row level security;
alter table current_rotation        enable row level security;
alter table rotation_snapshots      enable row level security;

drop policy if exists "public read" on catalog_items;
drop policy if exists "public read" on catalog_categories;
drop policy if exists "public read" on catalog_item_categories;
drop policy if exists "public read" on current_rotation;
drop policy if exists "public read" on rotation_snapshots;

create policy "public read" on catalog_items           for select using (true);
create policy "public read" on catalog_categories      for select using (true);
create policy "public read" on catalog_item_categories for select using (true);
create policy "public read" on current_rotation        for select using (true);
create policy "public read" on rotation_snapshots      for select using (true);
-- No insert/update/delete policies => writes happen only via the service role.

-- ── Private tables: RLS on, NO policies => anon/authenticated denied entirely ──
alter table users               enable row level security;
alter table bungie_accounts     enable row level security;
alter table system_credentials  enable row level security;
alter table config              enable row level security;
alter table wishlist            enable row level security;
alter table notification_prefs  enable row level security;
alter table notifications       enable row level security;

-- Verification (security review): with only the anon key,
--   select from bungie_accounts / wishlist  -> 0 rows / denied
--   select from current_rotation            -> works
--   insert into current_rotation            -> denied
