-- Étape 4 — Tableau de bord : tous les calculs sont faits en base.
-- Période = [p_debut, p_fin[ en dates locales (Europe/Paris), comparée à la période précédente de même durée.

create or replace function app.indicateurs(p_art text, p_debut timestamptz, p_fin timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with fac as (
    select count(*) as nb, coalesce(sum(total_ttc), 0) as ca
    from public.factures
    where artisan_id = p_art and statut = 'emise' and emise_at >= p_debut and emise_at < p_fin
  ), dem as (
    select count(*) as nb from public.demandes
    where artisan_id = p_art and created_at >= p_debut and created_at < p_fin
  ), dev as (
    select count(*) filter (where statut <> 'en_preparation' and statut <> 'erreur') as envoyes,
           count(*) filter (where statut = 'signe') as signes
    from public.devis
    where artisan_id = p_art and envoye_at >= p_debut and envoye_at < p_fin
  ), delai as (
    select avg(extract(epoch from (i.debut - d.created_at)) / 3600.0) as heures
    from public.interventions i join public.demandes d on d.id = i.demande_id
    where i.artisan_id = p_art and i.statut <> 'annulee' and i.created_at >= p_debut and i.created_at < p_fin
  ), term as (
    select count(*) as nb from public.interventions
    where artisan_id = p_art and statut = 'terminee' and terminee_at >= p_debut and terminee_at < p_fin
  )
  select jsonb_build_object(
    'ca_ttc', round(fac.ca, 2),
    'demandes_recues', dem.nb,
    'devis_envoyes', dev.envoyes,
    'devis_signes', dev.signes,
    'taux_signature', case when dev.envoyes > 0 then round(100.0 * dev.signes / dev.envoyes, 1) end,
    'panier_moyen', case when fac.nb > 0 then round(fac.ca / fac.nb, 2) end,
    'delai_moyen_heures', round(delai.heures::numeric, 1),
    'interventions_terminees', term.nb
  )
  from fac, dem, dev, delai, term
$$;

create or replace function public.tableau_de_bord(p_debut date, p_fin date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_art text := app.exiger_gerant();
  v_debut timestamptz := p_debut::timestamp at time zone 'Europe/Paris';
  v_fin timestamptz := p_fin::timestamp at time zone 'Europe/Paris';
  v_duree integer := p_fin - p_debut;
  v_prec_debut timestamptz := (p_debut - (p_fin - p_debut))::timestamp at time zone 'Europe/Paris';
  v_pas text := case when p_fin - p_debut > 62 then 'month' else 'week' end;
  v_jour date := (now() at time zone 'Europe/Paris')::date;
begin
  if p_debut is null or p_fin is null or p_fin <= p_debut or v_duree > 400 then
    raise exception 'Période invalide.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'periode', jsonb_build_object('debut', p_debut, 'fin', p_fin, 'pas', v_pas),
    'actuel', app.indicateurs(v_art, v_debut, v_fin),
    'precedent', app.indicateurs(v_art, v_prec_debut, v_debut),

    -- CA facturé par semaine (ou par mois au-delà de deux mois)
    'ca_par_periode', (
      select coalesce(jsonb_agg(jsonb_build_object('debut', s.p::date, 'ca_ttc', coalesce(f.ca, 0)) order by s.p), '[]'::jsonb)
      from generate_series(date_trunc(v_pas, p_debut::timestamp), (p_fin - 1)::timestamp, ('1 ' || v_pas)::interval) as s(p)
      left join (
        select date_trunc(v_pas, emise_at at time zone 'Europe/Paris') as p, sum(total_ttc) as ca
        from public.factures
        where artisan_id = v_art and statut = 'emise' and emise_at >= v_debut and emise_at < v_fin
        group by 1
      ) f on f.p = s.p
    ),

    -- Interventions (hors annulées) par technicien sur la période
    'interventions_par_technicien', (
      select coalesce(jsonb_agg(jsonb_build_object('technicien_id', t.id, 'nom', t.nom, 'couleur', t.couleur,
               'terminees', coalesce(x.terminees, 0), 'planifiees', coalesce(x.planifiees, 0)) order by t.nom), '[]'::jsonb)
      from public.techniciens t
      left join (
        select technicien_id,
               count(*) filter (where statut = 'terminee') as terminees,
               count(*) filter (where statut = 'planifiee') as planifiees
        from public.interventions
        where artisan_id = v_art and statut <> 'annulee' and debut >= v_debut and debut < v_fin
        group by technicien_id
      ) x on x.technicien_id = t.id
      where t.artisan_id = v_art
    ),

    -- À traiter (indépendant de la période)
    'a_traiter', jsonb_build_object(
      'devis_sans_reponse', (
        select coalesce(jsonb_agg(jsonb_build_object('demande_id', d.demande_id, 'numero', d.numero, 'client', dem.client_nom,
                 'total_ttc', d.total_ttc, 'envoye_at', d.envoye_at) order by d.envoye_at), '[]'::jsonb)
        from public.devis d join public.demandes dem on dem.id = d.demande_id
        where d.artisan_id = v_art and d.statut = 'envoye' and d.envoye_at < now() - interval '3 days' and d.valide_jusqu > now()
      ),
      'a_planifier', (
        select coalesce(jsonb_agg(jsonb_build_object('demande_id', dem.id, 'reference', dem.reference, 'client', dem.client_nom,
                 'note', dem.planification_note, 'depuis', dem.updated_at) order by dem.updated_at), '[]'::jsonb)
        from public.demandes dem
        where dem.artisan_id = v_art and dem.etape = 'devis_signe'
          and not exists (select 1 from public.interventions i where i.demande_id = dem.id and i.statut <> 'annulee')
      ),
      'interventions_du_jour', (
        select coalesce(jsonb_agg(jsonb_build_object('intervention_id', i.id, 'demande_id', i.demande_id, 'debut', i.debut, 'fin', i.fin,
                 'technicien', t.nom, 'couleur', t.couleur, 'client', dem.client_nom, 'adresse', i.adresse, 'statut', i.statut) order by i.debut), '[]'::jsonb)
        from public.interventions i
        join public.techniciens t on t.id = i.technicien_id
        join public.demandes dem on dem.id = i.demande_id
        where i.artisan_id = v_art and i.statut <> 'annulee'
          and i.debut >= v_jour::timestamp at time zone 'Europe/Paris'
          and i.debut < (v_jour + 1)::timestamp at time zone 'Europe/Paris'
      )
    )
  );
end $$;

revoke execute on function app.indicateurs(text, timestamptz, timestamptz) from public;
revoke execute on function public.tableau_de_bord(date, date) from public;
grant execute on function public.tableau_de_bord(date, date) to authenticated;

-- Couleurs par défaut des techniciens qui n'en ont pas encore (une par technicien et par entreprise)
with palette(rang, couleur) as (
  values (1, '#2563eb'), (2, '#16a34a'), (3, '#9333ea'), (4, '#db2777'), (5, '#0891b2'), (6, '#ca8a04'), (7, '#dc2626'), (8, '#4f46e5')
), a_colorer as (
  select id, ((row_number() over (partition by artisan_id order by created_at, id) - 1) % 8) + 1 as rang
  from public.techniciens where couleur is null
)
update public.techniciens t set couleur = p.couleur
from a_colorer x join palette p on p.rang = x.rang
where t.id = x.id;

-- Agenda en temps réel (Realtime applique les règles de lecture de la table)
do $$ begin
  alter publication supabase_realtime add table public.interventions;
exception when duplicate_object then null; when undefined_object then null; end $$;
