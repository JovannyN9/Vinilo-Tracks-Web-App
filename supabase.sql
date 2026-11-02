-- =========================================================
-- Vinilo Tracks — tabla de wishlist en Supabase
-- Pega todo esto en Supabase → SQL Editor → New query → Run
-- =========================================================

create table if not exists public.wishlist (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  release_id  bigint      not null,          -- ID del disco en Discogs
  titulo      text,
  artista     text,
  anio        int,
  pais        text,
  portada     text,
  created_at  timestamptz not null default now(),
  primary key (user_id, release_id)          -- un disco no se repite en la lista de la misma persona
);

-- Row Level Security: cada quien solo ve y toca SU wishlist
alter table public.wishlist enable row level security;

drop policy if exists "ver mi wishlist"    on public.wishlist;
drop policy if exists "agregar a mi wishlist" on public.wishlist;
drop policy if exists "quitar de mi wishlist" on public.wishlist;

create policy "ver mi wishlist"
  on public.wishlist for select
  using (auth.uid() = user_id);

create policy "agregar a mi wishlist"
  on public.wishlist for insert
  with check (auth.uid() = user_id);

create policy "quitar de mi wishlist"
  on public.wishlist for delete
  using (auth.uid() = user_id);

-- Permisos: la tabla solo la pueden usar personas con sesión iniciada.
-- (Necesario si en Supabase desactivaste "Automatically expose new tables", que es lo recomendado.)
-- RLS de arriba se encarga de que cada quien solo toque SU wishlist.
grant select, insert, delete on public.wishlist to authenticated;
revoke all on public.wishlist from anon;

-- Bonus: los discos más deseados. Solo tú lo ves desde el panel de Supabase (Table Editor),
-- los visitantes no tienen acceso.
create or replace view public.wishlist_populares
with (security_invoker = false) as
  select release_id, max(artista) as artista, max(titulo) as titulo, count(*) as personas
  from public.wishlist
  group by release_id
  order by personas desc;

revoke all on public.wishlist_populares from anon, authenticated;
