-- ShootLink schema. Run this once in the Supabase SQL editor.

-- ============================================================
-- Tables
-- ============================================================

create table public.shoots (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  address            text not null,
  beds               int,
  baths              numeric,
  sqft               int,
  notes              text,
  agent_name         text,
  description_short  text,
  description_medium text,
  description_long   text,
  created_at         timestamptz not null default now()
);

create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  shoot_id     uuid not null references public.shoots (id) on delete cascade,
  storage_path text not null,
  sort_order   int not null default 0
);

-- The gallery loads all photos for one shoot; this index makes that lookup
-- instant instead of a full-table scan.
create index photos_shoot_id_idx on public.photos (shoot_id);

-- ============================================================
-- Row Level Security
-- ============================================================
-- Once enabled, every query is denied unless a policy allows it.

alter table public.shoots enable row level security;
alter table public.photos enable row level security;

-- Public gallery: anyone (the "anon" role) can read.
create policy "public read shoots"
  on public.shoots for select
  using (true);

create policy "public read photos"
  on public.photos for select
  using (true);

-- Writes: only authenticated (logged-in) users.
create policy "authenticated write shoots"
  on public.shoots for insert to authenticated
  with check (true);

create policy "authenticated update shoots"
  on public.shoots for update to authenticated
  using (true);

create policy "authenticated delete shoots"
  on public.shoots for delete to authenticated
  using (true);

create policy "authenticated write photos"
  on public.photos for insert to authenticated
  with check (true);

create policy "authenticated update photos"
  on public.photos for update to authenticated
  using (true);

create policy "authenticated delete photos"
  on public.photos for delete to authenticated
  using (true);

-- ============================================================
-- Storage
-- ============================================================
-- A public bucket serves images over plain URLs with no signing step.
-- Paths contain the shoot's UUID, so they are unguessable in practice.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Reading from a public bucket needs no policy; writing still does.
create policy "authenticated upload photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');

create policy "authenticated update photo objects"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos');

create policy "authenticated delete photo objects"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos');
