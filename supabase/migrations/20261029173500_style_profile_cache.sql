-- The style card on home (P1-3): one card per user, regenerated when the
-- closet it was made from changes. input_hash identifies that closet; a card
-- exists once input_hash is set.
--
-- Opening home with a stale card starts a regeneration. style_profile_claim
-- lets only one request at a time do it, and at most one attempt per
-- cooldown: generating_token marks a regeneration in progress (given up on
-- after 2 minutes), generating_since is when the last one started.

alter table public.style_profiles
  add column input_hash text,
  add column prompt_version text,
  add column headline jsonb,
  add column generating_since timestamptz,
  add column generating_token uuid;

-- Nothing writes this table yet; keep the newest row per user just in case.
delete from public.style_profiles a
  using public.style_profiles b
  where a.user_id = b.user_id and (a.generated_at, a.id) < (b.generated_at, b.id);

drop index public.style_profiles_user_idx;
create unique index style_profiles_user_key on public.style_profiles (user_id);

-- A token if this request may regenerate the user's card for p_hash, else
-- null: the card is already for p_hash, another request is on it, or the last
-- attempt started less than p_cooldown ago. The conditional upsert locks the
-- user's row, so two requests cannot both get a token.
create function public.style_profile_claim(p_user uuid, p_hash text, p_cooldown interval)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  token uuid := gen_random_uuid();
  claimed uuid;
begin
  insert into public.style_profiles as p (user_id, generating_since, generating_token)
  values (p_user, now(), token)
  on conflict (user_id) do update
    set generating_since = now(), generating_token = token
    where p.input_hash is distinct from p_hash
      and (p.generating_token is null or p.generating_since < now() - interval '2 minutes')
      and (p.generating_since is null or p.generating_since < now() - p_cooldown)
  returning p.generating_token into claimed;
  return claimed;
end;
$$;

-- Server only, like ai_reserve.
revoke execute on function public.style_profile_claim(uuid, text, interval) from public, anon, authenticated;
grant execute on function public.style_profile_claim(uuid, text, interval) to service_role;
