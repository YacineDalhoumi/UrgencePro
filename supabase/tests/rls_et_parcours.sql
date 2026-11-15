-- Tests de sécurité (RLS) et du parcours complet, exécutés en base.
-- Tout se passe dans un seul bloc qui se termine TOUJOURS par une exception : rien n'est conservé.
-- Résultat attendu : « TESTS OK (n vérifications) ». Toute autre erreur indique la vérification en échec.
--
-- Lancer : coller ce fichier dans l'éditeur SQL Supabase (ou via l'outil execute_sql).

do $$
declare
  ua uuid := gen_random_uuid();  -- gérant entreprise A
  ub uuid := gen_random_uuid();  -- gérant entreprise B
  ut1 uuid := gen_random_uuid(); -- technicien 1 de A
  ut2 uuid := gen_random_uuid(); -- technicien 2 de A
  jeton text := 'jeton-de-test-' || gen_random_uuid();
  r jsonb;
  dem jsonb;
  fac jsonb;
  v_int uuid;
  n integer;
  t text;
  ok boolean;
  nb integer := 0;
  h_jeton text := app.empreinte(jeton);
  h_autre text := app.empreinte('autre-jeton');
begin
  -- ——— Données de test (en tant que propriétaire) ———
  insert into auth.users (instance_id, id, aud, role, email) values
    ('00000000-0000-0000-0000-000000000000', ua, 'authenticated', 'authenticated', 'gerant-a@test.invalid'),
    ('00000000-0000-0000-0000-000000000000', ub, 'authenticated', 'authenticated', 'gerant-b@test.invalid'),
    ('00000000-0000-0000-0000-000000000000', ut1, 'authenticated', 'authenticated', 'tech-1@test.invalid'),
    ('00000000-0000-0000-0000-000000000000', ut2, 'authenticated', 'authenticated', 'tech-2@test.invalid');
  insert into public.artisans (id, entreprise, lien_avis_google, validite_devis_jours)
  values ('ART-TEST-A', 'Entreprise A (test)', 'https://exemple.invalid/avis-a', 30),
         ('ART-TEST-B', 'Entreprise B (test)', null, 30);
  insert into public.techniciens (id, artisan_id, nom) values
    ('TEST-A-T1', 'ART-TEST-A', 'Tech Un'), ('TEST-A-T2', 'ART-TEST-A', 'Tech Deux'), ('TEST-B-T1', 'ART-TEST-B', 'Tech B');
  insert into public.membres (user_id, artisan_id, role, technicien_id) values
    (ua, 'ART-TEST-A', 'gerant', null), (ub, 'ART-TEST-B', 'gerant', null),
    (ut1, 'ART-TEST-A', 'technicien', 'TEST-A-T1'), (ut2, 'ART-TEST-A', 'technicien', 'TEST-A-T2');
  insert into public.clients (id, artisan_id, nom, email) values ('TEST-B-CLI', 'ART-TEST-B', 'Client de B', 'client-b@test.invalid');
  insert into public.demandes (reference, artisan_id, client_id, client_nom, message, type_demande)
  values ('TEST-B-DEM', 'ART-TEST-B', 'TEST-B-CLI', 'Client de B', 'Demande privée de B', 'devis');
  -- Clé serveur de test (le vrai secret est restauré par l'annulation finale)
  insert into app.secrets (nom, valeur_hash) values ('cle_serveur', app.empreinte('cle-de-test'))
  on conflict (nom) do update set valeur_hash = excluded.valeur_hash;

  -- ——— 1. Gérant A crée une demande → devis réservé ———
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  dem := public.creer_demande('Porte claquée, besoin d''ouverture et changement de cylindre',
    jsonb_build_object('nom', 'Client A', 'telephone', '06 00 00 00 01', 'email', 'Client-A@test.invalid', 'adresse', '1 rue du Test, Paris'),
    'email', h_jeton);
  if dem ->> 'numero_devis' !~ '^DEV-\d{4}-00001$' then raise exception 'ÉCHEC 1 : numéro de devis %', dem ->> 'numero_devis'; end if;
  nb := nb + 1;

  select etape into t from public.demandes where id = (dem ->> 'demande_id')::uuid;
  if t <> 'nouvelle' then raise exception 'ÉCHEC 1b : étape %', t; end if;
  nb := nb + 1;

  -- ——— 2. Isolement : A ne voit rien de B ———
  select count(*) into n from public.demandes where artisan_id = 'ART-TEST-B';
  if n <> 0 then raise exception 'ÉCHEC 2 : le gérant A voit % demande(s) de B', n; end if;
  select count(*) into n from public.clients where artisan_id = 'ART-TEST-B';
  if n <> 0 then raise exception 'ÉCHEC 2b : le gérant A voit des clients de B'; end if;
  select count(*) into n from public.techniciens where artisan_id <> 'ART-TEST-A';
  if n <> 0 then raise exception 'ÉCHEC 2c : le gérant A voit des techniciens d''autres entreprises'; end if;
  select count(*) into n from public.artisans;
  if n <> 1 then raise exception 'ÉCHEC 2d : le gérant A voit % entreprises', n; end if;
  -- Écriture directe interdite (insert sans règle)
  begin
    insert into public.demandes (artisan_id, message) values ('ART-TEST-B', 'intrusion');
    raise exception 'ÉCHEC 2e : insertion directe acceptée';
  exception when insufficient_privilege then null; end;
  -- Modification d'une autre entreprise : aucune ligne touchée
  update public.demandes set message = 'piraté' where artisan_id = 'ART-TEST-B';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ÉCHEC 2f : le gérant A a modifié une demande de B'; end if;
  nb := nb + 6;

  -- ——— 3. Agent : enregistrement du devis ———
  perform public.enregistrer_devis((dem ->> 'devis_id')::uuid,
    '{"lignes":[{"designation":"Ouverture de porte","quantite":1,"prix_unitaire_ht":90,"total_ht":90},{"designation":"Cylindre","quantite":1,"prix_unitaire_ht":60,"total_ht":60}],"total_ht":150,"tva_taux":"10","montant_tva":"15,00","total_ttc":165}'::jsonb,
    '{"pdf":"devis.pdf","email_envoye":true,"email_destinataire":"test@exemple.invalid"}'::jsonb, true, true);
  select etape into t from public.demandes where id = (dem ->> 'demande_id')::uuid;
  if t <> 'devis_envoye' then raise exception 'ÉCHEC 3 : étape %', t; end if;
  select count(*) into n from public.devis where id = (dem ->> 'devis_id')::uuid and total_ttc = 165 and montant_tva = 15 and statut = 'envoye';
  if n <> 1 then raise exception 'ÉCHEC 3b : totaux du devis mal enregistrés'; end if;
  nb := nb + 2;

  -- ——— 4. Gérant B ne peut pas toucher au devis de A ———
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.devis where artisan_id = 'ART-TEST-A';
  if n <> 0 then raise exception 'ÉCHEC 4 : le gérant B voit les devis de A'; end if;
  begin
    perform public.enregistrer_devis((dem ->> 'devis_id')::uuid, '{}'::jsonb, '{}'::jsonb, false, true);
    raise exception 'ÉCHEC 4b : le gérant B a modifié le devis de A';
  exception when no_data_found then null; end;
  begin
    perform public.planifier_manuellement((dem ->> 'demande_id')::uuid, 'TEST-B-T1', now() + interval '1 day', now() + interval '1 day 1 hour');
    raise exception 'ÉCHEC 4c : le gérant B a planifié une demande de A';
  exception when no_data_found then null; end;
  nb := nb + 3;

  -- ——— 5. Client (anonyme) : lecture et signature par le jeton ———
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1","user-agent":"NavigateurDeTest/1.0"}', true);
  set local role anon;
  begin
    perform 1 from public.devis limit 1;
    raise exception 'ÉCHEC 5 : un anonyme lit la table des devis';
  exception when insufficient_privilege then null; end;
  begin
    perform public.creer_demande('test anonyme', '{"email":"x@test.invalid"}', 'email', h_autre);
    raise exception 'ÉCHEC 5b : un anonyme crée une demande';
  exception when insufficient_privilege then null; end;
  if public.devis_public('mauvais-jeton') is not null then raise exception 'ÉCHEC 5c : un mauvais jeton ouvre un devis'; end if;
  r := public.devis_public(jeton);
  if r ->> 'numero' <> dem ->> 'numero_devis' or (r ->> 'total_ttc')::numeric <> 165 or r -> 'entreprise' ->> 'nom' <> 'Entreprise A (test)' then
    raise exception 'ÉCHEC 5d : contenu public du devis %', r;
  end if;
  r := public.signer_devis(jeton, 'Client A', 'pas-une-image');
  if (r ->> 'ok')::boolean then raise exception 'ÉCHEC 5e : signature invalide acceptée'; end if;
  r := public.signer_devis(jeton, 'Client A', 'data:image/png;base64,iVBORw0KGgo=');
  if not (r ->> 'ok')::boolean then raise exception 'ÉCHEC 5f : signature refusée %', r; end if;
  r := public.signer_devis(jeton, 'Client A', 'data:image/png;base64,iVBORw0KGgo=');
  if r ->> 'raison' <> 'deja_signe' then raise exception 'ÉCHEC 5g : double signature %', r; end if;
  r := public.refuser_devis(jeton, 'trop tard');
  if (r ->> 'ok')::boolean then raise exception 'ÉCHEC 5h : refus après signature accepté'; end if;
  nb := nb + 8;

  reset role;
  select count(*) into n from public.devis
  where id = (dem ->> 'devis_id')::uuid and statut = 'signe' and signature_ip = '203.0.113.7'
    and signature_user_agent = 'NavigateurDeTest/1.0' and signataire_nom = 'Client A'
    and empreinte_sha256 = app.empreinte(contenu_signe::text) and empreinte_sha256 ~ '^[0-9a-f]{64}$';
  if n <> 1 then raise exception 'ÉCHEC 5i : preuve de signature incomplète'; end if;
  -- Devis signé figé
  begin
    update public.devis set total_ttc = 1 where id = (dem ->> 'devis_id')::uuid;
    raise exception 'ÉCHEC 5j : devis signé modifiable';
  exception when raise_exception then
    if sqlerrm not like 'Un devis signé%' then raise; end if;
  end;
  select etape into t from public.demandes where id = (dem ->> 'demande_id')::uuid;
  if t <> 'devis_signe' then raise exception 'ÉCHEC 5k : étape %', t; end if;
  nb := nb + 3;

  -- ——— 6. Serveur : planification après signature (jeton + clé serveur) ———
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    perform public.planning_contexte(jeton, 'mauvaise-cle');
    raise exception 'ÉCHEC 6 : mauvaise clé serveur acceptée';
  exception when insufficient_privilege then null; end;
  r := public.planning_contexte(jeton, 'cle-de-test');
  if jsonb_array_length(r -> 'techniciens') <> 2 then raise exception 'ÉCHEC 6b : techniciens du contexte %', r -> 'techniciens'; end if;
  r := public.planifier_apres_signature(jeton, 'cle-de-test', 'TEST-A-T1',
         date_trunc('hour', now()) + interval '2 days 9 hours', date_trunc('hour', now()) + interval '2 days 10 hours 30 minutes');
  if not (r ->> 'ok')::boolean then raise exception 'ÉCHEC 6c : planification %', r; end if;
  v_int := (r ->> 'intervention_id')::uuid;
  r := public.planifier_apres_signature(jeton, 'cle-de-test', 'TEST-A-T1',
         date_trunc('hour', now()) + interval '3 days', date_trunc('hour', now()) + interval '3 days 1 hour');
  if r ->> 'raison' <> 'deja_planifiee' then raise exception 'ÉCHEC 6d : double planification %', r; end if;
  nb := nb + 4;
  reset role;

  select etape into t from public.demandes where id = (dem ->> 'demande_id')::uuid;
  if t <> 'planifiee' then raise exception 'ÉCHEC 6e : étape %', t; end if;
  -- Chevauchement interdit pour un même technicien
  r := app.creer_intervention('ART-TEST-A', (select id from public.demandes where reference = 'TEST-B-DEM'), null, 'TEST-A-T1',
         date_trunc('hour', now()) + interval '2 days 10 hours', date_trunc('hour', now()) + interval '2 days 11 hours', 'systeme');
  if r ->> 'raison' not in ('demande_inconnue', 'chevauchement') then raise exception 'ÉCHEC 6f : %', r; end if;
  begin
    insert into public.interventions (artisan_id, demande_id, technicien_id, debut, fin)
    values ('ART-TEST-A', (dem ->> 'demande_id')::uuid, 'TEST-A-T1',
            date_trunc('hour', now()) + interval '2 days 10 hours', date_trunc('hour', now()) + interval '2 days 11 hours');
    raise exception 'ÉCHEC 6g : chevauchement accepté';
  exception when exclusion_violation then null; end;
  nb := nb + 3;

  -- ——— 7. Techniciens : chacun ne voit que son agenda ———
  perform set_config('request.jwt.claims', json_build_object('sub', ut2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.interventions;
  if n <> 0 then raise exception 'ÉCHEC 7 : le technicien 2 voit l''intervention du technicien 1'; end if;
  select count(*) into n from public.demandes;
  if n <> 0 then raise exception 'ÉCHEC 7b : le technicien 2 voit des demandes'; end if;
  begin
    perform public.terminer_intervention(v_int, 'constat', '[]', '[]');
    raise exception 'ÉCHEC 7c : le technicien 2 termine l''intervention du technicien 1';
  exception when no_data_found then null; end;
  begin
    perform public.tableau_de_bord(current_date, current_date + 1);
    raise exception 'ÉCHEC 7d : un technicien ouvre le tableau de bord';
  exception when insufficient_privilege then null; end;
  update public.interventions set technicien_id = 'TEST-A-T2' where id = v_int;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ÉCHEC 7e : un technicien réattribue une intervention'; end if;
  nb := nb + 5;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', ut1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.interventions;
  if n <> 1 then raise exception 'ÉCHEC 7f : le technicien 1 voit % intervention(s)', n; end if;
  select count(*) into n from public.devis;
  if n <> 0 then raise exception 'ÉCHEC 7g : un technicien voit les devis'; end if;
  select count(*) into n from public.demandes;
  if n <> 1 then raise exception 'ÉCHEC 7h : le technicien 1 voit % demande(s)', n; end if;
  nb := nb + 3;

  -- ——— 8. Intervention terminée → facture numérotée ———
  fac := public.terminer_intervention(v_int, 'Cylindre bloqué', '["Ouverture","Remplacement du cylindre"]', '["Cylindre A2P"]');
  if fac ->> 'numero_facture' !~ '^FAC-\d{4}-000001$' then raise exception 'ÉCHEC 8 : numéro de facture %', fac ->> 'numero_facture'; end if;
  if fac ->> 'lien_avis_google' <> 'https://exemple.invalid/avis-a' then raise exception 'ÉCHEC 8b : lien avis'; end if;
  -- Relance : même numéro, pas de trou
  r := public.terminer_intervention(v_int, null, null, null);
  if r ->> 'numero_facture' <> fac ->> 'numero_facture' then raise exception 'ÉCHEC 8c : relance a changé le numéro'; end if;
  perform public.enregistrer_facture((fac ->> 'facture_id')::uuid,
    '{"lignes":[{"designation":"Ouverture","total_ht":150}],"total_ht":150,"tva_taux":10,"montant_tva":15,"total_ttc":165,"conditions_paiement":"À réception"}',
    '{"pdf":"facture.pdf","email_envoye":true}', true);
  reset role;
  select etape into t from public.demandes where id = (dem ->> 'demande_id')::uuid;
  if t <> 'terminee' then raise exception 'ÉCHEC 8d : étape %', t; end if;
  begin
    update public.factures set total_ttc = 1 where id = (fac ->> 'facture_id')::uuid;
    raise exception 'ÉCHEC 8e : facture émise modifiable';
  exception when raise_exception then
    if sqlerrm not like 'Une facture émise%' then raise; end if;
  end;
  nb := nb + 5;

  -- ——— 9. Historique horodaté complet ———
  select string_agg(etape_apres || '/' || auteur_type, ' > ' order by id) into t
  from public.demande_historique where demande_id = (dem ->> 'demande_id')::uuid;
  if t <> 'nouvelle/gerant > devis_envoye/systeme > devis_signe/client > planifiee/systeme > terminee/technicien' then
    raise exception 'ÉCHEC 9 : historique %', t;
  end if;
  nb := nb + 1;

  -- ——— 10. Tableau de bord (gérant A) ———
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.tableau_de_bord((now() at time zone 'Europe/Paris')::date, (now() at time zone 'Europe/Paris')::date + 1);
  if (r -> 'actuel' ->> 'ca_ttc')::numeric <> 165 or (r -> 'actuel' ->> 'demandes_recues')::int <> 1
     or (r -> 'actuel' ->> 'taux_signature')::numeric <> 100 or (r -> 'actuel' ->> 'interventions_terminees')::int <> 1
     or (r -> 'actuel' ->> 'panier_moyen')::numeric <> 165 then
    raise exception 'ÉCHEC 10 : indicateurs %', r -> 'actuel';
  end if;
  nb := nb + 1;
  reset role;

  raise exception 'TESTS OK (% vérifications)', nb;
end $$;
