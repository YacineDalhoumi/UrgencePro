-- Étape 2 — Row Level Security : une entreprise ne voit jamais les données d'une autre.
-- Gérant : tout ce qui concerne son entreprise. Technicien : ses interventions et ce qui s'y rattache.
-- n8n écrit avec sa propre clé de service (non concernée par ces règles).

-- Helper : le technicien connecté intervient-il sur cette demande ?
create or replace function app.technicien_sur_demande(p_demande_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.interventions i
    where i.demande_id = p_demande_id
      and i.technicien_id = app.technicien_courant()
      and i.artisan_id = app.entreprise_courante()
  )
$$;
revoke execute on function app.technicien_sur_demande(uuid) from public;
grant execute on function app.technicien_sur_demande(uuid) to authenticated;

-- ——— membres ———
drop policy if exists membres_lecture on public.membres;
create policy membres_lecture on public.membres for select to authenticated
  using (user_id = auth.uid() or (artisan_id = app.entreprise_courante() and app.est_gerant()));

-- ——— artisans ———
drop policy if exists artisans_lecture on public.artisans;
create policy artisans_lecture on public.artisans for select to authenticated
  using (id = app.entreprise_courante());
drop policy if exists artisans_modification on public.artisans;
create policy artisans_modification on public.artisans for update to authenticated
  using (id = app.entreprise_courante() and app.est_gerant())
  with check (id = app.entreprise_courante());

-- ——— techniciens ———
drop policy if exists techniciens_lecture on public.techniciens;
create policy techniciens_lecture on public.techniciens for select to authenticated
  using (artisan_id = app.entreprise_courante());
drop policy if exists techniciens_ajout on public.techniciens;
create policy techniciens_ajout on public.techniciens for insert to authenticated
  with check (artisan_id = app.entreprise_courante() and app.est_gerant());
drop policy if exists techniciens_modification on public.techniciens;
create policy techniciens_modification on public.techniciens for update to authenticated
  using (artisan_id = app.entreprise_courante() and app.est_gerant())
  with check (artisan_id = app.entreprise_courante());

-- ——— clients ———
drop policy if exists clients_lecture on public.clients;
create policy clients_lecture on public.clients for select to authenticated
  using (
    artisan_id = app.entreprise_courante()
    and (
      app.est_gerant()
      or exists (select 1 from public.demandes d where d.client_id = clients.id and app.technicien_sur_demande(d.id))
    )
  );
drop policy if exists clients_ecriture on public.clients;
create policy clients_ecriture on public.clients for update to authenticated
  using (artisan_id = app.entreprise_courante() and app.est_gerant())
  with check (artisan_id = app.entreprise_courante());

-- ——— demandes ———
drop policy if exists demandes_lecture on public.demandes;
create policy demandes_lecture on public.demandes for select to authenticated
  using (artisan_id = app.entreprise_courante() and (app.est_gerant() or app.technicien_sur_demande(id)));
drop policy if exists demandes_modification on public.demandes;
create policy demandes_modification on public.demandes for update to authenticated
  using (artisan_id = app.entreprise_courante() and app.est_gerant())
  with check (artisan_id = app.entreprise_courante());

-- ——— demande_historique ———
drop policy if exists historique_lecture on public.demande_historique;
create policy historique_lecture on public.demande_historique for select to authenticated
  using (artisan_id = app.entreprise_courante() and (app.est_gerant() or app.technicien_sur_demande(demande_id)));

-- ——— devis (création, envoi et signature passent par des fonctions contrôlées) ———
drop policy if exists devis_lecture on public.devis;
create policy devis_lecture on public.devis for select to authenticated
  using (artisan_id = app.entreprise_courante() and app.est_gerant());

-- ——— interventions ———
drop policy if exists interventions_lecture on public.interventions;
create policy interventions_lecture on public.interventions for select to authenticated
  using (artisan_id = app.entreprise_courante() and (app.est_gerant() or technicien_id = app.technicien_courant()));
-- Déplacement / réattribution : gérant uniquement, et seulement vers un technicien de l'entreprise
drop policy if exists interventions_modification on public.interventions;
create policy interventions_modification on public.interventions for update to authenticated
  using (artisan_id = app.entreprise_courante() and app.est_gerant())
  with check (
    artisan_id = app.entreprise_courante()
    and exists (select 1 from public.techniciens t where t.id = technicien_id and t.artisan_id = app.entreprise_courante())
  );

-- ——— factures ———
drop policy if exists factures_lecture on public.factures;
create policy factures_lecture on public.factures for select to authenticated
  using (
    artisan_id = app.entreprise_courante()
    and (app.est_gerant() or exists (
      select 1 from public.interventions i where i.id = factures.intervention_id and i.technicien_id = app.technicien_courant()
    ))
  );

-- ——— agent_traitements ———
drop policy if exists traitements_lecture on public.agent_traitements;
create policy traitements_lecture on public.agent_traitements for select to authenticated
  using (artisan_id = app.entreprise_courante() and app.est_gerant());

-- Aucun accès anonyme direct aux tables métier (la page publique passe par des fonctions)
revoke all on public.membres, public.artisans, public.techniciens, public.clients, public.demandes,
  public.demande_historique, public.devis, public.interventions, public.factures, public.agent_traitements from anon;
