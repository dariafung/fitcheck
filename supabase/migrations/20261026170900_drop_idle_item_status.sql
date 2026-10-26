-- There is no "idle" item status: an item is worn (active), being passed on,
-- or a purchase-check candidate. Rows that were idle become active.

update public.items set status = 'active' where status = 'idle';

alter table public.items drop constraint items_status_check;
alter table public.items add constraint items_status_check
  check (status in ('active', 'passing_on', 'candidate'));
