-- What a passing-on item is offered at: the asking price in US cents and its
-- condition. Both are asked for when an item is passed on; items passed on
-- before these columns existed keep nulls until edited.

alter table public.items
  add column asking_price_cents integer
    check (asking_price_cents is null or asking_price_cents between 0 and 10000000),
  add column condition text
    check (condition in ('new_with_tags', 'like_new', 'good', 'fair'));
