-- Resale matching (P1-5).
--
-- items.size is what the owner typed (M, 28, US 8): free text, read by code
-- when matching buyers. An item on its way out (passing_on) must have one;
-- the app checks that, since an item's size can be typed before it is.
--
-- Every profile has three sizes, picked from fixed lists. The app requires
-- them when a profile is saved; older rows stay null until then.
-- shoe_size holds the fit and the US size together: W7.5 is women's 7.5,
-- M9 is men's 9; half sizes are written .5, whole sizes without .0.
--
-- resale_matches caches one buy check per passing-on item and buyer, run
-- from the buyer's side. fingerprint identifies what the check was run on;
-- a row whose fingerprint no longer matches is stale.

alter table public.items
  add column size text
    check (size is null or (char_length(size) between 1 and 20 and size = btrim(size)));

alter table public.users
  add column top_size text
    check (top_size in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  add column bottom_size text
    check (bottom_size in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  add column shoe_size text
    check (shoe_size ~ '^[WM](([4-9]|1[0-4])(\.5)?|15)$');

create table public.resale_matches (
  item_id uuid not null references public.items (id) on delete cascade,
  buyer_id uuid not null references public.users (id) on delete cascade,
  seller_id uuid not null references public.users (id) on delete cascade,
  fingerprint text not null,
  score numeric not null check (score between 0 and 100),
  -- What the seller may see about the match: short, about the item.
  highlights text[] not null default '{}',
  -- Only ever shown to the buyer.
  buyer_reasons text[] not null default '{}',
  checked_at timestamptz not null default now(),
  primary key (item_id, buyer_id),
  check (buyer_id <> seller_id)
);
create index resale_matches_buyer_idx on public.resale_matches (buyer_id);
create index resale_matches_seller_idx on public.resale_matches (seller_id);

alter table public.resale_matches enable row level security;
