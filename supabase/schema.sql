-- ShootLink schema. Run this once in the Supabase SQL editor.
-- Every statement is idempotent, so re-running it is safe.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.shoots (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
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

-- Upgrade path for installs created before shoots had an owner. Those ran
-- single-user, so every existing row belongs to the first account.
alter table public.shoots
  add column if not exists user_id uuid references auth.users (id) on delete cascade;
update public.shoots
  set user_id = (select id from auth.users order by created_at limit 1)
  where user_id is null;
alter table public.shoots alter column user_id set default auth.uid();
alter table public.shoots alter column user_id set not null;

create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  shoot_id     uuid not null references public.shoots (id) on delete cascade,
  storage_path text not null,
  sort_order   int not null default 0
);

-- The gallery loads all photos for one shoot; this index makes that lookup
-- instant instead of a full-table scan.
create index if not exists photos_shoot_id_idx on public.photos (shoot_id);

-- The dashboard lists one photographer's shoots on every page load.
create index if not exists shoots_user_id_idx on public.shoots (user_id);

-- ============================================================
-- Row Level Security
-- ============================================================
-- Once enabled, every query is denied unless a policy allows it.
--
-- Nothing here grants the anon role any access. The anon key ships in the
-- browser, so a public read policy would let anyone list every photographer's
-- shoots straight off the REST endpoint — the slug being unguessable does not
-- help when the whole table can be dumped. Public galleries are instead read
-- server-side with the service role key, which never leaves the server.

alter table public.shoots enable row level security;
alter table public.photos enable row level security;

drop policy if exists "public read shoots" on public.shoots;
drop policy if exists "public read photos" on public.photos;

drop policy if exists "owner read shoots" on public.shoots;
create policy "owner read shoots"
  on public.shoots for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "authenticated write shoots" on public.shoots;
drop policy if exists "owner write shoots" on public.shoots;
create policy "owner write shoots"
  on public.shoots for insert to authenticated
  with check (user_id = auth.uid());

-- The with check half stops an owner from handing a row to someone else.
drop policy if exists "authenticated update shoots" on public.shoots;
drop policy if exists "owner update shoots" on public.shoots;
create policy "owner update shoots"
  on public.shoots for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "authenticated delete shoots" on public.shoots;
drop policy if exists "owner delete shoots" on public.shoots;
create policy "owner delete shoots"
  on public.shoots for delete to authenticated
  using (user_id = auth.uid());

-- A photo is reachable exactly when its shoot is.
drop policy if exists "owner read photos" on public.photos;
create policy "owner read photos"
  on public.photos for select to authenticated
  using (
    exists (
      select 1 from public.shoots
      where shoots.id = photos.shoot_id and shoots.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated write photos" on public.photos;
drop policy if exists "owner write photos" on public.photos;
create policy "owner write photos"
  on public.photos for insert to authenticated
  with check (
    exists (
      select 1 from public.shoots
      where shoots.id = photos.shoot_id and shoots.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated update photos" on public.photos;
drop policy if exists "owner update photos" on public.photos;
create policy "owner update photos"
  on public.photos for update to authenticated
  using (
    exists (
      select 1 from public.shoots
      where shoots.id = photos.shoot_id and shoots.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated delete photos" on public.photos;
drop policy if exists "owner delete photos" on public.photos;
create policy "owner delete photos"
  on public.photos for delete to authenticated
  using (
    exists (
      select 1 from public.shoots
      where shoots.id = photos.shoot_id and shoots.user_id = auth.uid()
    )
  );

-- ============================================================
-- Storage
-- ============================================================
-- A public bucket serves images over plain URLs with no signing step. Paths
-- start with the shoot's UUID, so they are unguessable, and without a select
-- policy on storage.objects the bucket cannot be listed to discover them.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Uploads land at "<shoot id>/<n>-<filename>", so the first path segment says
-- which shoot — and therefore which photographer — a file belongs to.
-- Comparing it as text rather than casting to uuid keeps a malformed path from
-- erroring out instead of simply failing the check.
drop policy if exists "authenticated upload photos" on storage.objects;
drop policy if exists "owner upload photos" on storage.objects;
create policy "owner upload photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.shoots
      where shoots.id::text = (storage.foldername(name))[1]
        and shoots.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated update photo objects" on storage.objects;
drop policy if exists "owner update photo objects" on storage.objects;
create policy "owner update photo objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.shoots
      where shoots.id::text = (storage.foldername(name))[1]
        and shoots.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated delete photo objects" on storage.objects;
drop policy if exists "owner delete photo objects" on storage.objects;
create policy "owner delete photo objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.shoots
      where shoots.id::text = (storage.foldername(name))[1]
        and shoots.user_id = auth.uid()
    )
  );
