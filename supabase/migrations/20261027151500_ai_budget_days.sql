-- The daily AI budget moves from server memory into the database, so every
-- server instance shares one count and restarts do not reset it. One row per
-- Chicago day; no per-call log.
--
-- Before a live call, ai_reserve adds the call's worst-case cost if the day
-- stays within the limit. After it, the real cost is added and the
-- reservation given back with ai_settle. The conditional upsert locks the
-- day's row, so concurrent calls cannot overspend.

create table public.ai_budget_days (
  day date primary key,
  spent_usd numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ai_budget_days enable row level security;

create function public.ai_reserve(p_day date, p_usd numeric, p_limit numeric)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  reserved boolean;
begin
  insert into public.ai_budget_days as b (day, spent_usd)
  select p_day, p_usd
  where p_usd <= p_limit
  on conflict (day) do update
    set spent_usd = b.spent_usd + excluded.spent_usd, updated_at = now()
    where b.spent_usd + excluded.spent_usd <= p_limit
  returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

-- Adds p_usd to the day's spend; negative gives a reservation back.
create function public.ai_settle(p_day date, p_usd numeric)
returns void
language sql
set search_path = ''
as $$
  insert into public.ai_budget_days as b (day, spent_usd)
  values (p_day, p_usd)
  on conflict (day) do update
    set spent_usd = b.spent_usd + excluded.spent_usd, updated_at = now();
$$;

-- Item photos that no item points at, uploaded before p_before: screenshots
-- cropped during entry but never saved. The daily cron removes them through
-- the Storage API (storage rows cannot be deleted with SQL). p_prefix keeps
-- tests to their own folder.
create function public.orphan_item_images(p_before timestamptz, p_limit integer, p_prefix text default '')
returns setof text
language sql
stable
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'item-images'
    and o.created_at < p_before
    and starts_with(o.name, p_prefix)
    and not exists (
      select 1 from public.items i where o.name = any (i.image_paths)
    )
  order by o.created_at
  limit p_limit;
$$;

-- Server only: the secret key's role may call these, browser roles may not.
revoke execute on function public.ai_reserve(date, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.ai_settle(date, numeric) from public, anon, authenticated;
revoke execute on function public.orphan_item_images(timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.ai_reserve(date, numeric, numeric) to service_role;
grant execute on function public.ai_settle(date, numeric) to service_role;
grant execute on function public.orphan_item_images(timestamptz, integer, text) to service_role;
