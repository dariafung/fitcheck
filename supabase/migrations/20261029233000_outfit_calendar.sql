-- The outfit calendar (P1-4). outfit_logs already holds one row per outfit:
-- a day can have several, each with its own optional occasion. Item ids are
-- stored sorted, so the same outfit can't be logged twice for one day.
alter table public.outfit_logs
  add constraint outfit_logs_unique_outfit unique (user_id, worn_on, item_ids),
  add constraint outfit_logs_occasion_check
    check (occasion is null or occasion in ('work', 'school', 'social', 'sport', 'home'));

-- Whether the user keeps a calendar at all. Turning it off hides it and keeps
-- the logs.
alter table public.users
  add column wear_log_enabled boolean not null default true;

-- What the model noticed in a user's log, one row per user. A cache: written
-- again when its input changes, at most once a day.
create table public.wear_insights (
  user_id uuid primary key references public.users (id) on delete cascade,
  input_hash text not null,
  prompt_version text not null,
  insights jsonb not null,
  generated_at timestamptz not null default now()
);

alter table public.wear_insights enable row level security;
