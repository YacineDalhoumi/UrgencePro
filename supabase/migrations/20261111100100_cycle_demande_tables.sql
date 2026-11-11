-- Étape 3 — Cycle de vie d'une demande : colonnes ajoutées et nouvelles tables.
-- Aucune suppression, aucun renommage. La colonne demandes.statut garde son sens technique (traite / erreur).

create extension if not exists btree_gist with schema extensions;

-- ——— Ajouts sur les tables existantes ———
alter table public.artisans add column if not exists logo_url text;

alter table public.techniciens
  add column if not exists couleur text,
  add column if not exists telephone text;

alter table public.demandes
  add column if not exists etape text not null default 'nouvelle',
  add column if not exists canal text not null default 'email',
  add column if not exists client_adresse text,
  add column if not exists a_planifier_manuellement boolean not null default false,
  add column if not exists planification_note text,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.demandes add constraint demandes_etape_check
    check (etape in ('nouvelle', 'devis_envoye', 'devis_signe', 'planifiee', 'terminee', 'refusee', 'annulee'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.demandes add constraint demandes_canal_check check (canal in ('email', 'sms'));
exception when duplicate_object then null; end $$;

create index if not exists demandes_artisan_date_idx on public.demandes(artisan_id, created_at desc);
create index if not exists demandes_artisan_etape_idx on public.demandes(artisan_id, etape);

-- ——— Numérotation continue par entreprise, par type et par année ———
create table if not exists public.compteurs (
  artisan_id text not null references public.artisans(id) on delete cascade,
  type text not null check (type in ('demande', 'devis', 'facture')),
  annee integer not null,
  dernier integer not null default 0,
  primary key (artisan_id, type, annee)
);
alter table public.compteurs enable row level security;
revoke all on public.compteurs from anon, authenticated;

-- ——— Historique horodaté des étapes ———
create table if not exists public.demande_historique (
  id bigint generated always as identity primary key,
  artisan_id text not null references public.artisans(id) on delete cascade,
  demande_id uuid not null references public.demandes(id) on delete cascade,
  etape_avant text,
  etape_apres text not null,
  auteur_type text not null check (auteur_type in ('gerant', 'technicien', 'client', 'systeme')),
  auteur_id uuid,
  commentaire text,
  created_at timestamptz not null default now()
);
create index if not exists demande_historique_demande_idx on public.demande_historique(demande_id, created_at);
alter table public.demande_historique enable row level security;

-- ——— Devis ———
create table if not exists public.devis (
  id uuid primary key default gen_random_uuid(),
  artisan_id text not null references public.artisans(id) on delete cascade,
  demande_id uuid not null references public.demandes(id) on delete cascade,
  numero text not null,
  statut text not null default 'en_preparation'
    check (statut in ('en_preparation', 'envoye', 'signe', 'refuse', 'expire', 'erreur')),
  canal text not null default 'email' check (canal in ('email', 'sms')),
  lignes jsonb not null default '[]'::jsonb,
  total_ht numeric(12, 2),
  tva_taux numeric(5, 2),
  montant_tva numeric(12, 2),
  total_ttc numeric(12, 2),
  validite_jours integer not null default 30,
  valide_jusqu timestamptz not null,
  avertissements jsonb not null default '[]'::jsonb,
  infos_manquantes jsonb not null default '[]'::jsonb,
  message_client text,
  -- Lien de signature : seule l'empreinte SHA-256 du jeton est stockée
  token_hash text not null unique,
  envoye_at timestamptz,
  pdf_nom text,
  email_envoye boolean not null default false,
  email_destinataire text,
  -- Preuve de signature
  signe_at timestamptz,
  signataire_nom text,
  signature_image text,
  signature_ip text,
  signature_user_agent text,
  empreinte_sha256 text,
  contenu_signe jsonb,
  refuse_at timestamptz,
  refus_motif text,
  created_at timestamptz not null default now(),
  unique (artisan_id, numero)
);
create index if not exists devis_demande_idx on public.devis(demande_id);
create index if not exists devis_artisan_statut_idx on public.devis(artisan_id, statut);
alter table public.devis enable row level security;

-- ——— Interventions (agenda) ———
create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  artisan_id text not null references public.artisans(id) on delete cascade,
  demande_id uuid not null references public.demandes(id) on delete cascade,
  devis_id uuid references public.devis(id) on delete set null,
  technicien_id text not null references public.techniciens(id),
  debut timestamptz not null,
  fin timestamptz not null,
  adresse text,
  statut text not null default 'planifiee' check (statut in ('planifiee', 'terminee', 'annulee')),
  constat text,
  travaux jsonb not null default '[]'::jsonb,
  materiel jsonb not null default '[]'::jsonb,
  terminee_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interventions_duree_check check (fin > debut),
  -- Un technicien ne peut pas avoir deux interventions qui se chevauchent
  constraint interventions_sans_chevauchement exclude using gist (
    technicien_id with =,
    tstzrange(debut, fin, '[)') with &&
  ) where (statut <> 'annulee')
);
create index if not exists interventions_artisan_debut_idx on public.interventions(artisan_id, debut);
create index if not exists interventions_demande_idx on public.interventions(demande_id);
alter table public.interventions enable row level security;

-- ——— Factures ———
create table if not exists public.factures (
  id uuid primary key default gen_random_uuid(),
  artisan_id text not null references public.artisans(id) on delete cascade,
  demande_id uuid not null references public.demandes(id) on delete cascade,
  intervention_id uuid not null unique references public.interventions(id) on delete cascade,
  numero text not null,
  statut text not null default 'en_preparation' check (statut in ('en_preparation', 'emise', 'erreur')),
  lignes jsonb not null default '[]'::jsonb,
  total_ht numeric(12, 2),
  tva_taux numeric(5, 2),
  montant_tva numeric(12, 2),
  total_ttc numeric(12, 2),
  conditions_paiement text,
  pdf_nom text,
  email_envoye boolean not null default false,
  email_destinataire text,
  emise_at timestamptz,
  created_at timestamptz not null default now(),
  unique (artisan_id, numero)
);
create index if not exists factures_artisan_emise_idx on public.factures(artisan_id, emise_at);
alter table public.factures enable row level security;

-- ——— Journal des appels à l'agent pour une demande existante (écrit par n8n) ———
create table if not exists public.agent_traitements (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references public.demandes(id) on delete cascade,
  reference text,
  artisan_id text references public.artisans(id) on delete cascade,
  client_id text,
  client_nom text,
  client_telephone text,
  client_email text,
  message text,
  type_demande text,
  routage jsonb,
  resultat jsonb,
  actions jsonb,
  statut text,
  donnees_fictives boolean default true,
  created_at timestamptz not null default now()
);
create index if not exists agent_traitements_demande_idx on public.agent_traitements(demande_id, created_at);
alter table public.agent_traitements enable row level security;

-- ——— Secrets internes (non exposés par l'API) ———
create table if not exists app.secrets (
  nom text primary key,
  valeur_hash text not null,
  updated_at timestamptz not null default now()
);
revoke all on app.secrets from public, anon, authenticated;

-- ——— Déclencheurs ———

-- Historique automatique de chaque changement d'étape
create or replace function app.trace_etape() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_auteur text := nullif(current_setting('app.auteur', true), '');
begin
  if tg_op = 'UPDATE' and new.etape is not distinct from old.etape then
    return new;
  end if;
  if v_auteur is null then
    v_auteur := coalesce(app.role_courant(), 'systeme');
  end if;
  insert into public.demande_historique (artisan_id, demande_id, etape_avant, etape_apres, auteur_type, auteur_id, commentaire)
  values (
    new.artisan_id, new.id,
    case when tg_op = 'UPDATE' then old.etape end,
    new.etape, v_auteur,
    case when v_auteur in ('gerant', 'technicien') then auth.uid() end,
    nullif(current_setting('app.commentaire', true), '')
  );
  return new;
end $$;

drop trigger if exists demandes_trace_etape on public.demandes;
create trigger demandes_trace_etape
  after insert or update of etape on public.demandes
  for each row when (new.artisan_id is not null)
  execute function app.trace_etape();

create or replace function app.maj_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists demandes_updated_at on public.demandes;
create trigger demandes_updated_at before update on public.demandes
  for each row execute function app.maj_updated_at();
drop trigger if exists interventions_updated_at on public.interventions;
create trigger interventions_updated_at before update on public.interventions
  for each row execute function app.maj_updated_at();

-- Un devis signé est figé (ni modification ni suppression). Seule la purge des données de test peut passer outre.
create or replace function app.verrou_devis_signe() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.statut = 'signe' and coalesce(current_setting('app.purge_test', true), '') <> 'on' then
    raise exception 'Un devis signé ne peut plus être modifié.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists devis_verrou on public.devis;
create trigger devis_verrou before update or delete on public.devis
  for each row execute function app.verrou_devis_signe();

-- Une facture émise est figée (correction par avoir uniquement)
create or replace function app.verrou_facture_emise() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.statut = 'emise' and coalesce(current_setting('app.purge_test', true), '') <> 'on' then
    raise exception 'Une facture émise ne peut plus être modifiée.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists factures_verrou on public.factures;
create trigger factures_verrou before update or delete on public.factures
  for each row execute function app.verrou_facture_emise();

revoke execute on function app.trace_etape(), app.maj_updated_at(), app.verrou_devis_signe(), app.verrou_facture_emise() from public;
