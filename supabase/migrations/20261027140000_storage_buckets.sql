-- Private storage buckets, created here so the hosted project gets them too.
-- item-images was only declared in supabase/config.toml before, which the
-- hosted project never reads. Existing buckets are left as they are.
-- Only the server (secret key) reads or writes either bucket: no policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('item-images', 'item-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  -- Voice feelings: 16 kHz mono 16-bit WAV, at most 3 minutes (5.76 MB).
  -- Deleted as soon as they are transcribed.
  ('feeling-audio', 'feeling-audio', false, 8388608, array['audio/wav'])
on conflict (id) do nothing;
