-- Étape 2 — Base multi-entreprises : rattachement des comptes à une entreprise avec un rôle.
-- Uniquement des ajouts. Le schéma « app » n'est pas exposé par l'API : il contient les fonctions internes.

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

create table if not exists public.membres (
  user_id uuid primary key references auth.users(id) on delete cascade,
  artisan_id text not null references public.artisans(id) on delete cascade,
  role text not null check (role in ('gerant', 'technicien')),
  technicien_id text references public.techniciens(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint membres_technicien_requis check (role = 'gerant' or technicien_id is not null)
);
create index if not exists membres_artisan_idx on public.membres(artisan_id);
alter table public.membres enable row level security;

-- Fonctions utilisées par les règles RLS (security definer : lisent « membres » sans boucle de règles)
create or replace function app.entreprise_courante() returns text
language sql stable security definer set search_path = '' as $$
  select m.artisan_id from public.membres m where m.user_id = auth.uid()
$$;

create or replace function app.role_courant() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.membres m where m.user_id = auth.uid()
$$;

create or replace function app.technicien_courant() returns text
language sql stable security definer set search_path = '' as $$
  select m.technicien_id from public.membres m where m.user_id = auth.uid()
$$;

create or replace function app.est_gerant() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select m.role = 'gerant' from public.membres m where m.user_id = auth.uid()), false)
$$;

revoke execute on all functions in schema app from public;
grant execute on function app.entreprise_courante(), app.role_courant(), app.technicien_courant(), app.est_gerant() to anon, authenticated;

-- Reprise de l'existant : les comptes déjà rattachés via app_metadata.artisan_id deviennent gérants de cette entreprise
insert into public.membres (user_id, artisan_id, role)
select u.id, u.raw_app_meta_data ->> 'artisan_id', 'gerant' from auth.users u
where exists (select 1 from public.artisans a where a.id = u.raw_app_meta_data ->> 'artisan_id')
on conflict (user_id) do nothing;
