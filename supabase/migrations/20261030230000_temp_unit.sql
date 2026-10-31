-- The unit a user sees and types temperatures in: 'F' or 'C'. Stored
-- temperatures (items' tempRangeF, weather) stay whole °F either way.
-- The app requires it when a profile is saved; older rows stay null until
-- then and show °F.

alter table public.users
  add column temp_unit text
    check (temp_unit in ('F', 'C'));
