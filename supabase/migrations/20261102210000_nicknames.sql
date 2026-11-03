-- users.display_name is now a name the person picks (at sign-up, or in
-- Profile). Accounts made before that were named after their email: the
-- part before the @, trimmed. Those get the default name instead.
--
-- Only rows that are certainly email-made are changed: not seed users, with
-- an auth user that has an email, and a display_name equal to that email's
-- part before the @. A row without an auth email, or a name that differs from
-- it, is left alone. Returns how many rows changed; kept so it can be checked.

create function public.rename_email_named_users()
returns integer
language sql
-- Reads auth.users, which only the owner may; callable by service_role only.
security definer
set search_path = ''
as $$
  with renamed as (
    update public.users as u
    set display_name = 'fitcheck member'
    from auth.users as a
    where a.id = u.id
      and not u.is_seed
      and a.email is not null
      and position('@' in a.email) > 1
      and u.display_name = btrim(split_part(a.email, '@', 1))
    returning u.id
  )
  select count(*)::integer from renamed;
$$;

revoke execute on function public.rename_email_named_users() from public, anon, authenticated;
grant execute on function public.rename_email_named_users() to service_role;

select public.rename_email_named_users();
