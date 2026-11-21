-- Star ratings on closet items.

-- How much the owner likes an item: 1 to 5 stars, null when not rated.
alter table public.items
  add column rating smallint check (rating between 1 and 5);

-- items.updated_at is what cached pairings are checked against: a pairing
-- judged before it is stale. A rating says nothing about how a piece pairs,
-- so an update that changes only the rating leaves updated_at alone.
drop trigger items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row
  when ((to_jsonb(new) - 'rating') is distinct from (to_jsonb(old) - 'rating'))
  execute function public.set_updated_at();
