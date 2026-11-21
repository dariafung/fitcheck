-- Personal tokens for calling the app from outside the browser: the iOS
-- Shortcut that sends a product-page screenshot to POST /api/shortcut/check.
-- The token itself is shown once, when it is made in Profile; only its
-- SHA-256 hash is kept, so a copy of this table can't be used to sign in.
-- Revoking a token deletes its row. last_used_at is set on every call.
--
-- RLS on with no policies, like every table: only the server reads it.

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  label text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index api_tokens_user_idx on public.api_tokens (user_id);

alter table public.api_tokens enable row level security;
