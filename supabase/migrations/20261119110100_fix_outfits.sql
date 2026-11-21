-- An outfit for a piece the owner is unhappy with, and saved outfits.

-- For an active item rated 1 or 2, or whose feeling says something bad about
-- it, the item page suggests one complete outfit from the same closet, with a
-- one-line reason, and the user can save it.

-- The suggestion, one row per item. A cache: written again when input_hash
-- (whether it is rated low, the complaints, the closet items the model chose
-- from and the prompt version) changes.
-- outfit_item_ids is stored sorted; it and reason are null when nothing in
-- the closet helps.
create table public.item_fix_outfits (
  item_id uuid primary key references public.items (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  input_hash text not null,
  prompt_version text not null,
  outfit_item_ids uuid[],
  reason text,
  generated_at timestamptz not null default now(),
  constraint item_fix_outfits_pick_check check ((outfit_item_ids is null) = (reason is null))
);
create index item_fix_outfits_user_idx on public.item_fix_outfits (user_id);

alter table public.item_fix_outfits enable row level security;

-- Outfits the user saved, each its own row and not tied to the item it was
-- suggested for. Item ids are stored sorted and unique, so the same outfit
-- can't be saved twice.
create table public.saved_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  item_ids uuid[] not null,
  created_at timestamptz not null default now(),
  constraint saved_outfits_pieces_check check (cardinality(item_ids) >= 2),
  constraint saved_outfits_unique_outfit unique (user_id, item_ids)
);
-- For "saved outfits that contain this item".
create index saved_outfits_item_ids_idx on public.saved_outfits using gin (item_ids);

alter table public.saved_outfits enable row level security;
