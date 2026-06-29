-- Everywherse derived history (data-engineer doc 01 §7). Powers feature F11.

-- Last seen: most recent snapshot_date per item.
create or replace view item_last_seen as
select item_hash, max(snapshot_date) as last_seen_date
from rotation_snapshots
group by item_hash;

-- Cost history: ordered series per item for the sparkline.
create or replace view item_cost_history as
select item_hash, snapshot_date, currency_type, cost_amount
from rotation_snapshots
order by item_hash, snapshot_date;

-- Cadence: distinct appearance days + first/last + count over all history.
create or replace view item_cadence as
select
  item_hash,
  count(distinct snapshot_date) as appearances,
  min(snapshot_date)           as first_seen_date,
  max(snapshot_date)           as last_seen_date
from rotation_snapshots
group by item_hash;

-- Never-discounted: items that have only ever appeared priced in Silver.
create or replace view item_never_discounted as
select item_hash
from rotation_snapshots
group by item_hash
having bool_and(currency_type = 'silver');

-- Views inherit the RLS of their base tables; rotation_snapshots is public-read,
-- so these are safe to expose to the anon client.
