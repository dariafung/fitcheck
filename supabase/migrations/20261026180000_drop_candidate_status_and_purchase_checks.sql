-- Items the user is thinking of buying are not stored, and a purchase check
-- keeps nothing once it has answered. So "candidate" is no longer an item
-- status (an item is worn, or being passed on) and purchase_checks goes away.
-- Any candidate rows are removed first (their pairings cascade).

drop table public.purchase_checks;

delete from public.items where status = 'candidate';

alter table public.items drop constraint items_status_check;
alter table public.items add constraint items_status_check
  check (status in ('active', 'passing_on'));
