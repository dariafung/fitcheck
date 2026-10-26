-- Initial schema: 5 P0 tables + 3 P1 tables.
-- RLS is enabled on every table with no policies: only the server, using the
-- secret key, can read or write. Enum-like columns use text + check so values
-- can be extended with a plain migration.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- P0 ---------------------------------------------------------------------

create table public.users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  height_cm numeric,
  weight_kg numeric,
  bust_cm numeric,
  waist_cm numeric,
  hip_cm numeric,
  inseam_cm numeric,
  body_shape text,
  lifestyle_mix jsonb not null default '{}'::jsonb,
  resale_opt_in boolean not null default false,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'idle', 'passing_on', 'candidate')),
  entry_method text not null
    check (entry_method in ('link', 'screenshot', 'photo', 'manual')),
  source_url text,
  retailer text,
  title text not null,
  brand text,
  price_cents integer check (price_cents >= 0),
  currency text,
  category text not null
    check (category in ('top', 'bottom', 'one_piece', 'shoes', 'outerwear', 'accessory')),
  image_paths text[] not null default '{}',
  ai_tags jsonb,
  user_tags jsonb not null default '{}'::jsonb,
  on_model boolean,
  raw_source jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_user_status_idx on public.items (user_id, status);

create table public.item_feelings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  raw_text text not null,
  source text not null check (source in ('typed', 'voice')),
  audio_path text,
  structured jsonb,
  parsed_at timestamptz,
  created_at timestamptz not null default now()
);
create index item_feelings_item_idx on public.item_feelings (item_id);

-- Any two items can be paired, including two candidates. The pair is stored
-- once with item_a_id < item_b_id; the unique pair doubles as the cache key.
create table public.pairings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  item_a_id uuid not null references public.items (id) on delete cascade,
  item_b_id uuid not null references public.items (id) on delete cascade,
  pairs boolean not null,
  reason text,
  source text not null check (source in ('rule', 'ai')),
  prompt_version text,
  created_at timestamptz not null default now(),
  check (item_a_id < item_b_id),
  unique (item_a_id, item_b_id)
);
create index pairings_item_b_idx on public.pairings (item_b_id);

create table public.purchase_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  candidate_item_id uuid not null references public.items (id) on delete cascade,
  match_score integer check (match_score between 0 and 100),
  gap_result jsonb,
  paired_item_ids uuid[] not null default '{}',
  reasons jsonb,
  outfit_image_path text,
  input_hash text not null,
  scoring_version text not null,
  created_at timestamptz not null default now()
);
create index purchase_checks_user_candidate_idx
  on public.purchase_checks (user_id, candidate_item_id);
create index purchase_checks_input_hash_idx on public.purchase_checks (input_hash);

-- P1 ---------------------------------------------------------------------

create table public.style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  suits jsonb not null default '[]'::jsonb,
  avoid jsonb not null default '[]'::jsonb,
  frequent_occasions jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
create index style_profiles_user_idx on public.style_profiles (user_id);

create table public.outfit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  worn_on date not null,
  item_ids uuid[] not null default '{}',
  occasion text,
  created_at timestamptz not null default now()
);
create index outfit_logs_user_worn_on_idx on public.outfit_logs (user_id, worn_on);

create table public.resale_buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  profile jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- updated_at triggers ------------------------------------------------------

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- RLS: on everywhere, no policies -----------------------------------------

alter table public.users enable row level security;
alter table public.items enable row level security;
alter table public.item_feelings enable row level security;
alter table public.pairings enable row level security;
alter table public.purchase_checks enable row level security;
alter table public.style_profiles enable row level security;
alter table public.outfit_logs enable row level security;
alter table public.resale_buyers enable row level security;
