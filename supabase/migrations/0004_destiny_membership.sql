-- The OAuth membership_id is the Bungie.net id, not the Destiny platform
-- membershipId needed for GetProfile/GetVendor. Store the Destiny id separately.
alter table users add column if not exists destiny_membership_id text;
