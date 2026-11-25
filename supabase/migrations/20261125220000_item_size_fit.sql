-- How an item's size turned out on its owner, for size advice by brand and
-- type: too small, just right or too big; null when not said.
alter table public.items
  add column size_fit text check (size_fit in ('small', 'right', 'large'));

-- Like a rating, this says nothing about how a piece pairs, so an update that
-- changes only these two leaves updated_at (and cached pairings) alone.
drop trigger items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row
  when (
    (to_jsonb(new) - 'rating' - 'size_fit') is distinct from (to_jsonb(old) - 'rating' - 'size_fit')
  )
  execute function public.set_updated_at();
