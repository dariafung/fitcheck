-- Daily counts of AI actions per caller, so one account can't spend the
-- whole day's budget. One row per subject, Chicago day and action; a new
-- day is a new row, so nothing needs resetting. A subject is a signed-in
-- user ('user:<id>'), one login session of the shared demo account
-- ('demo-session:<id>'), the demo account as a whole ('demo'), or a hashed
-- IP for sign-ups ('signup-ip:<sha256>').
--
-- Before an action, ai_take adds 1 if the count stays within the limit;
-- ai_give_back takes it back when the action failed on our side. The
-- conditional upsert locks the row, so concurrent requests cannot pass the
-- limit (same pattern as ai_reserve).

create table public.ai_usage_days (
  subject text not null,
  day date not null,
  action text not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject, day, action)
);

alter table public.ai_usage_days enable row level security;

create function public.ai_take(p_subject text, p_day date, p_action text, p_limit integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  taken boolean;
begin
  insert into public.ai_usage_days as u (subject, day, action, count)
  select p_subject, p_day, p_action, 1
  where p_limit >= 1
  on conflict (subject, day, action) do update
    set count = u.count + 1, updated_at = now()
    where u.count < p_limit
  returning true into taken;
  return coalesce(taken, false);
end;
$$;

create function public.ai_give_back(p_subject text, p_day date, p_action text)
returns void
language sql
set search_path = ''
as $$
  update public.ai_usage_days
    set count = greatest(count - 1, 0), updated_at = now()
    where subject = p_subject and day = p_day and action = p_action;
$$;

-- Server only, like ai_reserve.
revoke execute on function public.ai_take(text, date, text, integer) from public, anon, authenticated;
revoke execute on function public.ai_give_back(text, date, text) from public, anon, authenticated;
grant execute on function public.ai_take(text, date, text, integer) to service_role;
grant execute on function public.ai_give_back(text, date, text) to service_role;
