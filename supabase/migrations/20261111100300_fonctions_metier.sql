-- Fonctions métier du cycle de vie. Toutes en « security definer » avec des contrôles explicites :
--  - gérant / technicien : identifiés par leur session (auth.uid() → membres) ;
--  - client (page publique) : autorisé par le jeton du devis (seule son empreinte est en base) ;
--  - serveur sans session (planification automatique) : jeton + clé serveur (empreinte dans app.secrets).

-- ——— Utilitaires internes ———

create or replace function app.empreinte(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex')
$$;

-- Nombre depuis du JSON produit par l'IA (accepte 12.5, "12.5", "12,5")
create or replace function app.num(p jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case
    when p is null then null
    when jsonb_typeof(p) = 'number' then (p #>> '{}')::numeric
    when jsonb_typeof(p) = 'string' and (p #>> '{}') ~ '^\s*-?[0-9]+([.,][0-9]+)?\s*$'
      then replace(trim(p #>> '{}'), ',', '.')::numeric
  end
$$;

create or replace function app.cle_serveur_valide(p_cle text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from app.secrets s where s.nom = 'cle_serveur' and s.valeur_hash = app.empreinte(p_cle))
$$;

create or replace function app.exiger_gerant() returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_art text := app.entreprise_courante();
begin
  if v_art is null or not app.est_gerant() then
    raise exception 'Action réservée au gérant de l''entreprise.' using errcode = '42501';
  end if;
  return v_art;
end $$;

-- Numéro continu par entreprise, type et année (verrou de ligne : ni trou ni doublon)
create or replace function app.prochain_numero(p_artisan text, p_type text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_annee integer := extract(year from (now() at time zone 'Europe/Paris'))::integer;
  v_n integer;
begin
  insert into public.compteurs as c (artisan_id, type, annee, dernier)
  values (p_artisan, p_type, v_annee, 1)
  on conflict (artisan_id, type, annee) do update set dernier = c.dernier + 1
  returning dernier into v_n;
  return case p_type when 'devis' then 'DEV' when 'facture' then 'FAC' else 'DEM' end
    || '-' || v_annee || '-' || lpad(v_n::text, case p_type when 'facture' then 6 else 5 end, '0');
end $$;

-- Changement d'étape avec auteur explicite (repris par le déclencheur d'historique)
create or replace function app.changer_etape(p_demande_id uuid, p_etape text, p_auteur text, p_commentaire text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.auteur', p_auteur, true);
  perform set_config('app.commentaire', coalesce(p_commentaire, ''), true);
  update public.demandes set etape = p_etape where id = p_demande_id and etape is distinct from p_etape;
  perform set_config('app.auteur', '', true);
  perform set_config('app.commentaire', '', true);
end $$;

-- Création d'une intervention (contrôles communs à la planification automatique et manuelle)
create or replace function app.creer_intervention(
  p_artisan text, p_demande_id uuid, p_devis_id uuid, p_technicien_id text,
  p_debut timestamptz, p_fin timestamptz, p_auteur text, p_commentaire text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tech record;
  v_dem record;
  v_id uuid;
begin
  select * into v_tech from public.techniciens where id = p_technicien_id and artisan_id = p_artisan;
  if not found then return jsonb_build_object('ok', false, 'raison', 'technicien_inconnu'); end if;
  if v_tech.disponible is false then return jsonb_build_object('ok', false, 'raison', 'technicien_indisponible'); end if;
  if p_debut is null or p_fin is null or p_fin <= p_debut then return jsonb_build_object('ok', false, 'raison', 'horaires_invalides'); end if;
  if p_debut < now() then return jsonb_build_object('ok', false, 'raison', 'creneau_passe'); end if;
  select * into v_dem from public.demandes where id = p_demande_id and artisan_id = p_artisan;
  if not found then return jsonb_build_object('ok', false, 'raison', 'demande_inconnue'); end if;
  if exists (select 1 from public.interventions where demande_id = p_demande_id and statut <> 'annulee') then
    return jsonb_build_object('ok', false, 'raison', 'deja_planifiee');
  end if;
  begin
    insert into public.interventions (artisan_id, demande_id, devis_id, technicien_id, debut, fin, adresse)
    values (p_artisan, p_demande_id, p_devis_id, p_technicien_id, p_debut, p_fin, v_dem.client_adresse)
    returning id into v_id;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'raison', 'chevauchement');
  end;
  update public.demandes set a_planifier_manuellement = false, planification_note = null where id = p_demande_id;
  perform app.changer_etape(p_demande_id, 'planifiee', p_auteur, p_commentaire);
  return jsonb_build_object('ok', true, 'intervention_id', v_id, 'technicien_nom', v_tech.nom);
end $$;

-- Contenu exact d'un devis, utilisé pour l'empreinte SHA-256 de la signature
create or replace function app.contenu_devis(p_devis_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'numero', d.numero,
    'entreprise', a.entreprise,
    'siret', a.siret,
    'client', dem.client_nom,
    'adresse_intervention', dem.client_adresse,
    'lignes', d.lignes,
    'total_ht', d.total_ht,
    'tva_taux', d.tva_taux,
    'montant_tva', d.montant_tva,
    'total_ttc', d.total_ttc,
    'emis_le', d.envoye_at,
    'valide_jusqu', d.valide_jusqu
  )
  from public.devis d
  join public.artisans a on a.id = d.artisan_id
  join public.demandes dem on dem.id = d.demande_id
  where d.id = p_devis_id
$$;

-- ——— Gérant : nouvelle demande (client réutilisé ou créé, demande, devis réservé) ———
create or replace function public.creer_demande(p_message text, p_client jsonb, p_canal text, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_art text := app.exiger_gerant();
  v_email text := lower(nullif(trim(p_client ->> 'email'), ''));
  v_tel text := nullif(regexp_replace(coalesce(p_client ->> 'telephone', ''), '\D', '', 'g'), '');
  v_client_id text;
  v_demande_id uuid;
  v_reference text;
  v_numero text;
  v_validite integer;
  v_devis_id uuid;
  v_valide timestamptz;
begin
  if length(trim(coalesce(p_message, ''))) < 5 then raise exception 'Décrivez la demande.' using errcode = '22023'; end if;
  if v_email is null then raise exception 'L''email du client est obligatoire pour envoyer le devis.' using errcode = '22023'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Jeton invalide.' using errcode = '22023'; end if;

  select c.id into v_client_id from public.clients c
  where c.artisan_id = v_art
    and (lower(c.email) = v_email or (v_tel is not null and regexp_replace(coalesce(c.telephone, ''), '\D', '', 'g') = v_tel))
  order by c.created_at limit 1;

  if v_client_id is null then
    v_client_id := 'CLI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    insert into public.clients (id, artisan_id, nom, telephone, email, adresse)
    values (v_client_id, v_art, nullif(trim(p_client ->> 'nom'), ''), nullif(trim(p_client ->> 'telephone'), ''), v_email, nullif(trim(p_client ->> 'adresse'), ''));
  else
    update public.clients set
      nom = coalesce(nullif(trim(p_client ->> 'nom'), ''), nom),
      telephone = coalesce(nullif(trim(p_client ->> 'telephone'), ''), telephone),
      email = v_email,
      adresse = coalesce(nullif(trim(p_client ->> 'adresse'), ''), adresse)
    where id = v_client_id;
  end if;

  v_reference := app.prochain_numero(v_art, 'demande');
  perform set_config('app.auteur', 'gerant', true);
  insert into public.demandes (reference, artisan_id, client_id, client_nom, client_telephone, client_email, client_adresse,
                               message, type_demande, canal, etape, statut)
  values (v_reference, v_art, v_client_id, nullif(trim(p_client ->> 'nom'), ''), nullif(trim(p_client ->> 'telephone'), ''),
          v_email, nullif(trim(p_client ->> 'adresse'), ''), trim(p_message), 'devis', coalesce(nullif(p_canal, ''), 'email'),
          'nouvelle', 'en_cours')
  returning id into v_demande_id;
  perform set_config('app.auteur', '', true);

  select coalesce(validite_devis_jours, 30) into v_validite from public.artisans where id = v_art;
  v_valide := now() + make_interval(days => v_validite);
  v_numero := app.prochain_numero(v_art, 'devis');
  insert into public.devis (artisan_id, demande_id, numero, canal, token_hash, validite_jours, valide_jusqu)
  values (v_art, v_demande_id, v_numero, coalesce(nullif(p_canal, ''), 'email'), p_token_hash, v_validite, v_valide)
  returning id into v_devis_id;

  return jsonb_build_object('demande_id', v_demande_id, 'reference', v_reference, 'devis_id', v_devis_id,
    'numero_devis', v_numero, 'valide_jusqu', v_valide, 'artisan_id', v_art, 'client_id', v_client_id);
end $$;

-- Gérant : relancer la création d'un devis en erreur (nouveau jeton, même numéro)
create or replace function public.relancer_devis(p_demande_id uuid, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_art text := app.exiger_gerant();
  v_devis record;
  v_dem record;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Jeton invalide.' using errcode = '22023'; end if;
  select * into v_dem from public.demandes where id = p_demande_id and artisan_id = v_art;
  if not found then raise exception 'Demande introuvable.' using errcode = 'P0002'; end if;
  select * into v_devis from public.devis where demande_id = p_demande_id and statut in ('erreur', 'en_preparation')
  order by created_at desc limit 1;
  if not found then raise exception 'Aucun devis à relancer pour cette demande.' using errcode = 'P0002'; end if;
  update public.devis set token_hash = p_token_hash, statut = 'en_preparation',
    valide_jusqu = now() + make_interval(days => validite_jours)
  where id = v_devis.id;
  return jsonb_build_object('demande_id', v_dem.id, 'reference', v_dem.reference, 'devis_id', v_devis.id,
    'numero_devis', v_devis.numero, 'artisan_id', v_art, 'client_id', v_dem.client_id,
    'message', v_dem.message, 'canal', v_dem.canal,
    'client', jsonb_build_object('nom', v_dem.client_nom, 'telephone', v_dem.client_telephone, 'email', v_dem.client_email, 'adresse', v_dem.client_adresse));
end $$;

-- Gérant : enregistrer le devis renvoyé par l'agent (ou l'échec)
create or replace function public.enregistrer_devis(p_devis_id uuid, p_resultat jsonb, p_actions jsonb, p_succes boolean, p_donnees_fictives boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_art text := app.exiger_gerant();
  v_devis record;
begin
  select * into v_devis from public.devis where id = p_devis_id and artisan_id = v_art;
  if not found then raise exception 'Devis introuvable.' using errcode = 'P0002'; end if;
  if v_devis.statut not in ('en_preparation', 'erreur') then return; end if;
  if p_succes then
    update public.devis set
      statut = 'envoye',
      lignes = coalesce(p_resultat -> 'lignes', '[]'::jsonb),
      total_ht = app.num(p_resultat -> 'total_ht'),
      tva_taux = app.num(p_resultat -> 'tva_taux'),
      montant_tva = app.num(p_resultat -> 'montant_tva'),
      total_ttc = app.num(p_resultat -> 'total_ttc'),
      avertissements = coalesce(p_resultat -> 'avertissements', '[]'::jsonb),
      infos_manquantes = coalesce(p_resultat -> 'infos_manquantes', '[]'::jsonb),
      message_client = p_resultat ->> 'message_client',
      envoye_at = now(),
      pdf_nom = p_actions ->> 'pdf',
      email_envoye = coalesce((p_actions ->> 'email_envoye')::boolean, false),
      email_destinataire = p_actions ->> 'email_destinataire'
    where id = p_devis_id;
    update public.demandes set statut = 'traite', resultat = p_resultat, actions = p_actions,
      donnees_fictives = coalesce(p_donnees_fictives, true)
    where id = v_devis.demande_id;
    perform app.changer_etape(v_devis.demande_id, 'devis_envoye', 'systeme');
  else
    update public.devis set statut = 'erreur' where id = p_devis_id;
    update public.demandes set statut = 'erreur', resultat = p_resultat where id = v_devis.demande_id;
  end if;
end $$;

-- Gérant : annuler une demande
create or replace function public.annuler_demande(p_demande_id uuid, p_motif text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_art text := app.exiger_gerant();
begin
  if not exists (select 1 from public.demandes where id = p_demande_id and artisan_id = v_art and etape not in ('terminee', 'annulee')) then
    raise exception 'Cette demande ne peut pas être annulée.' using errcode = 'P0001';
  end if;
  update public.interventions set statut = 'annulee' where demande_id = p_demande_id and statut = 'planifiee';
  perform app.changer_etape(p_demande_id, 'annulee', 'gerant', nullif(trim(coalesce(p_motif, '')), ''));
end $$;

-- ——— Client (page publique, sans compte) ———

create or replace function public.devis_public(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_devis record;
begin
  select d.* into v_devis from public.devis d where d.token_hash = app.empreinte(p_token);
  if not found or v_devis.statut in ('en_preparation', 'erreur') then return null; end if;
  if v_devis.statut = 'envoye' and v_devis.valide_jusqu < now() then
    update public.devis set statut = 'expire' where id = v_devis.id;
    v_devis.statut := 'expire';
  end if;
  return (
    select jsonb_build_object(
      'numero', v_devis.numero, 'statut', v_devis.statut,
      'entreprise', jsonb_build_object('nom', a.entreprise, 'logo_url', a.logo_url, 'telephone', a.telephone,
                                        'email', a.email, 'adresse', a.adresse, 'siret', a.siret),
      'client', jsonb_build_object('nom', dem.client_nom, 'adresse', dem.client_adresse),
      'objet', dem.message,
      'lignes', v_devis.lignes, 'total_ht', v_devis.total_ht, 'tva_taux', v_devis.tva_taux,
      'montant_tva', v_devis.montant_tva, 'total_ttc', v_devis.total_ttc,
      'emis_le', v_devis.envoye_at, 'valide_jusqu', v_devis.valide_jusqu,
      'signe_at', v_devis.signe_at, 'signataire_nom', v_devis.signataire_nom,
      'empreinte', v_devis.empreinte_sha256, 'refuse_at', v_devis.refuse_at
    )
    from public.artisans a, public.demandes dem
    where a.id = v_devis.artisan_id and dem.id = v_devis.demande_id
  );
end $$;

create or replace function public.signer_devis(p_token text, p_nom text, p_signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_devis record;
  v_contenu jsonb;
  v_empreinte text;
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_ip text;
begin
  select * into v_devis from public.devis where token_hash = app.empreinte(p_token) for update;
  if not found then return jsonb_build_object('ok', false, 'raison', 'introuvable'); end if;
  if v_devis.statut = 'signe' then return jsonb_build_object('ok', false, 'raison', 'deja_signe'); end if;
  if v_devis.statut <> 'envoye' then return jsonb_build_object('ok', false, 'raison', v_devis.statut); end if;
  if v_devis.valide_jusqu < now() then
    update public.devis set statut = 'expire' where id = v_devis.id;
    return jsonb_build_object('ok', false, 'raison', 'expire');
  end if;
  if length(trim(coalesce(p_nom, ''))) < 2 then return jsonb_build_object('ok', false, 'raison', 'nom_requis'); end if;
  if p_signature !~ '^data:image/png;base64,' or length(p_signature) > 500000 then
    return jsonb_build_object('ok', false, 'raison', 'signature_invalide');
  end if;

  v_contenu := app.contenu_devis(v_devis.id);
  v_empreinte := app.empreinte(v_contenu::text);
  v_ip := coalesce(v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-real-ip', trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)));

  update public.devis set statut = 'signe', signe_at = now(), signataire_nom = trim(p_nom), signature_image = p_signature,
    signature_ip = nullif(v_ip, ''), signature_user_agent = left(v_headers ->> 'user-agent', 500),
    empreinte_sha256 = v_empreinte, contenu_signe = v_contenu
  where id = v_devis.id;
  perform app.changer_etape(v_devis.demande_id, 'devis_signe', 'client', 'Signé par ' || trim(p_nom));
  return jsonb_build_object('ok', true, 'empreinte', v_empreinte, 'signe_at', now());
end $$;

create or replace function public.refuser_devis(p_token text, p_motif text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_devis record;
begin
  select * into v_devis from public.devis where token_hash = app.empreinte(p_token) for update;
  if not found then return jsonb_build_object('ok', false, 'raison', 'introuvable'); end if;
  if v_devis.statut <> 'envoye' then return jsonb_build_object('ok', false, 'raison', v_devis.statut); end if;
  update public.devis set statut = 'refuse', refuse_at = now(), refus_motif = left(nullif(trim(coalesce(p_motif, '')), ''), 1000)
  where id = v_devis.id;
  perform app.changer_etape(v_devis.demande_id, 'refusee', 'client', left(nullif(trim(coalesce(p_motif, '')), ''), 300));
  return jsonb_build_object('ok', true);
end $$;

-- ——— Serveur (planification automatique après signature) : jeton + clé serveur ———

create or replace function public.planning_contexte(p_token text, p_cle text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_devis record; v_dem record;
begin
  if not app.cle_serveur_valide(p_cle) then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  select * into v_devis from public.devis where token_hash = app.empreinte(p_token);
  if not found or v_devis.statut <> 'signe' then return null; end if;
  select * into v_dem from public.demandes where id = v_devis.demande_id;
  return jsonb_build_object(
    'artisan_id', v_devis.artisan_id, 'demande_id', v_dem.id, 'reference', v_dem.reference, 'numero_devis', v_devis.numero,
    'message', v_dem.message, 'canal', v_dem.canal,
    'client', jsonb_build_object('nom', v_dem.client_nom, 'telephone', v_dem.client_telephone, 'email', v_dem.client_email, 'adresse', v_dem.client_adresse),
    'lignes', v_devis.lignes,
    'deja_planifie', exists (select 1 from public.interventions i where i.demande_id = v_dem.id and i.statut <> 'annulee'),
    'techniciens', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nom', t.nom, 'competences', t.competences, 'zone', t.zone, 'disponible', t.disponible) order by t.nom)
                             from public.techniciens t where t.artisan_id = v_devis.artisan_id), '[]'::jsonb),
    'creneaux_occupes', coalesce((select jsonb_agg(jsonb_build_object('technicien_id', i.technicien_id, 'debut', i.debut, 'fin', i.fin) order by i.debut)
                                  from public.interventions i
                                  where i.artisan_id = v_devis.artisan_id and i.statut = 'planifiee'
                                    and i.fin > now() and i.debut < now() + interval '30 days'), '[]'::jsonb)
  );
end $$;

create or replace function public.planifier_apres_signature(p_token text, p_cle text, p_technicien_id text, p_debut timestamptz, p_fin timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_devis record;
begin
  if not app.cle_serveur_valide(p_cle) then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  select * into v_devis from public.devis where token_hash = app.empreinte(p_token);
  if not found or v_devis.statut <> 'signe' then return jsonb_build_object('ok', false, 'raison', 'devis_non_signe'); end if;
  return app.creer_intervention(v_devis.artisan_id, v_devis.demande_id, v_devis.id, p_technicien_id, p_debut, p_fin, 'systeme', 'Planification automatique');
end $$;

create or replace function public.signaler_a_planifier(p_token text, p_cle text, p_raison text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_devis record;
begin
  if not app.cle_serveur_valide(p_cle) then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  select * into v_devis from public.devis where token_hash = app.empreinte(p_token);
  if not found then return; end if;
  update public.demandes set a_planifier_manuellement = true, planification_note = left(p_raison, 500)
  where id = v_devis.demande_id and not exists (select 1 from public.interventions i where i.demande_id = v_devis.demande_id and i.statut <> 'annulee');
end $$;

-- ——— Gérant : planification manuelle ———
create or replace function public.planifier_manuellement(p_demande_id uuid, p_technicien_id text, p_debut timestamptz, p_fin timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_art text := app.exiger_gerant();
  v_dem record;
  v_devis_id uuid;
begin
  select * into v_dem from public.demandes where id = p_demande_id and artisan_id = v_art;
  if not found then raise exception 'Demande introuvable.' using errcode = 'P0002'; end if;
  if v_dem.etape in ('terminee', 'annulee', 'refusee') then
    return jsonb_build_object('ok', false, 'raison', 'etape_' || v_dem.etape);
  end if;
  select id into v_devis_id from public.devis where demande_id = p_demande_id and statut = 'signe' limit 1;
  return app.creer_intervention(v_art, p_demande_id, v_devis_id, p_technicien_id, p_debut, p_fin, 'gerant', 'Planification manuelle');
end $$;

-- ——— Technicien ou gérant : intervention terminée → facture numérotée ———
create or replace function public.terminer_intervention(p_intervention_id uuid, p_constat text, p_travaux jsonb, p_materiel jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_art text := app.entreprise_courante();
  v_int record;
  v_dem record;
  v_fac record;
  v_tech record;
  v_devis record;
  v_avis text;
begin
  select * into v_int from public.interventions where id = p_intervention_id and artisan_id = v_art for update;
  if not found or not (app.est_gerant() or v_int.technicien_id = app.technicien_courant()) then
    raise exception 'Intervention introuvable.' using errcode = 'P0002';
  end if;
  if v_int.statut = 'annulee' then raise exception 'Cette intervention a été annulée.' using errcode = 'P0001'; end if;

  if v_int.statut = 'planifiee' then
    if length(trim(coalesce(p_constat, ''))) < 3 then raise exception 'Décrivez le constat.' using errcode = '22023'; end if;
    update public.interventions set statut = 'terminee', terminee_at = now(), constat = trim(p_constat),
      travaux = coalesce(p_travaux, '[]'::jsonb), materiel = coalesce(p_materiel, '[]'::jsonb)
    where id = p_intervention_id
    returning * into v_int;
  end if;

  -- Une seule facture par intervention ; le numéro est réservé une fois pour toutes (relance possible sans trou)
  select * into v_fac from public.factures where intervention_id = p_intervention_id;
  if not found then
    insert into public.factures (artisan_id, demande_id, intervention_id, numero)
    values (v_art, v_int.demande_id, p_intervention_id, app.prochain_numero(v_art, 'facture'))
    returning * into v_fac;
  end if;

  select * into v_dem from public.demandes where id = v_int.demande_id;
  select * into v_tech from public.techniciens where id = v_int.technicien_id;
  select * into v_devis from public.devis where id = v_int.devis_id;
  select lien_avis_google into v_avis from public.artisans where id = v_art;

  return jsonb_build_object(
    'facture_id', v_fac.id, 'numero_facture', v_fac.numero, 'facture_statut', v_fac.statut,
    'artisan_id', v_art, 'demande_id', v_dem.id, 'reference', v_dem.reference, 'message', v_dem.message, 'canal', v_dem.canal,
    'client', jsonb_build_object('nom', v_dem.client_nom, 'telephone', v_dem.client_telephone, 'email', v_dem.client_email, 'adresse', v_dem.client_adresse),
    'intervention', jsonb_build_object(
      'date', to_char(v_int.debut at time zone 'Europe/Paris', 'YYYY-MM-DD'),
      'technicien', v_tech.nom, 'adresse', v_int.adresse,
      'constat', v_int.constat, 'travaux', v_int.travaux, 'materiel', v_int.materiel,
      'duree_minutes', round(extract(epoch from (v_int.fin - v_int.debut)) / 60)),
    'devis', case when v_devis.id is null then null else jsonb_build_object('numero', v_devis.numero, 'lignes', v_devis.lignes,
      'total_ht', v_devis.total_ht, 'tva_taux', v_devis.tva_taux, 'total_ttc', v_devis.total_ttc) end,
    'lien_avis_google', v_avis
  );
end $$;

create or replace function public.enregistrer_facture(p_facture_id uuid, p_facture jsonb, p_actions jsonb, p_succes boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_art text := app.entreprise_courante();
  v_fac record;
  v_int record;
begin
  select * into v_fac from public.factures where id = p_facture_id and artisan_id = v_art for update;
  if not found then raise exception 'Facture introuvable.' using errcode = 'P0002'; end if;
  select * into v_int from public.interventions where id = v_fac.intervention_id;
  if not (app.est_gerant() or v_int.technicien_id = app.technicien_courant()) then
    raise exception 'Facture introuvable.' using errcode = 'P0002';
  end if;
  if v_fac.statut = 'emise' then return; end if;
  if p_succes then
    update public.factures set statut = 'emise', emise_at = now(),
      lignes = coalesce(p_facture -> 'lignes', '[]'::jsonb),
      total_ht = app.num(p_facture -> 'total_ht'), tva_taux = app.num(p_facture -> 'tva_taux'),
      montant_tva = app.num(p_facture -> 'montant_tva'), total_ttc = app.num(p_facture -> 'total_ttc'),
      conditions_paiement = p_facture ->> 'conditions_paiement',
      pdf_nom = p_actions ->> 'pdf',
      email_envoye = coalesce((p_actions ->> 'email_envoye')::boolean, false),
      email_destinataire = p_actions ->> 'email_destinataire'
    where id = p_facture_id;
    perform app.changer_etape(v_fac.demande_id, 'terminee', coalesce(app.role_courant(), 'systeme'));
  else
    update public.factures set statut = 'erreur' where id = p_facture_id;
  end if;
end $$;

-- ——— Gérant : comptes des techniciens ———
-- Crée le compte de connexion d'un technicien avec un mot de passe provisoire (à changer à la première connexion).
create or replace function public.creer_compte_technicien(p_technicien_id text, p_email text, p_mot_de_passe text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_art text := app.exiger_gerant();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_uid uuid;
begin
  if not exists (select 1 from public.techniciens where id = p_technicien_id and artisan_id = v_art) then
    raise exception 'Technicien introuvable.' using errcode = 'P0002';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Adresse email invalide.' using errcode = '22023'; end if;
  if length(coalesce(p_mot_de_passe, '')) < 10 then raise exception 'Mot de passe provisoire : 10 caractères minimum.' using errcode = '22023'; end if;
  if exists (select 1 from public.membres m where m.technicien_id = p_technicien_id) then
    raise exception 'Ce technicien a déjà un compte.' using errcode = '23505';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Un compte existe déjà avec cette adresse email.' using errcode = '23505';
  end if;

  v_uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token,
    reauthentication_token, is_sso_user, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_mot_de_passe, extensions.gen_salt('bf', 10)), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', '', false, false);
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  values (gen_random_uuid(), v_uid, v_uid::text,
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now());
  insert into public.membres (user_id, artisan_id, role, technicien_id) values (v_uid, v_art, 'technicien', p_technicien_id);
  return jsonb_build_object('ok', true, 'email', v_email);
end $$;

-- ——— Droits d'exécution ———
revoke execute on function
  app.empreinte(text), app.num(jsonb), app.cle_serveur_valide(text), app.exiger_gerant(), app.prochain_numero(text, text),
  app.changer_etape(uuid, text, text, text), app.creer_intervention(text, uuid, uuid, text, timestamptz, timestamptz, text, text),
  app.contenu_devis(uuid)
from public;

revoke execute on function
  public.creer_demande(text, jsonb, text, text), public.relancer_devis(uuid, text),
  public.enregistrer_devis(uuid, jsonb, jsonb, boolean, boolean), public.annuler_demande(uuid, text),
  public.devis_public(text), public.signer_devis(text, text, text), public.refuser_devis(text, text),
  public.planning_contexte(text, text), public.planifier_apres_signature(text, text, text, timestamptz, timestamptz),
  public.signaler_a_planifier(text, text, text), public.planifier_manuellement(uuid, text, timestamptz, timestamptz),
  public.terminer_intervention(uuid, text, jsonb, jsonb), public.enregistrer_facture(uuid, jsonb, jsonb, boolean),
  public.creer_compte_technicien(text, text, text)
from public;

-- Utilisateurs connectés (les contrôles de rôle sont dans chaque fonction)
grant execute on function
  public.creer_demande(text, jsonb, text, text), public.relancer_devis(uuid, text),
  public.enregistrer_devis(uuid, jsonb, jsonb, boolean, boolean), public.annuler_demande(uuid, text),
  public.planifier_manuellement(uuid, text, timestamptz, timestamptz),
  public.terminer_intervention(uuid, text, jsonb, jsonb), public.enregistrer_facture(uuid, jsonb, jsonb, boolean),
  public.creer_compte_technicien(text, text, text)
to authenticated;

-- Page publique (jeton) et serveur sans session (jeton + clé serveur)
grant execute on function
  public.devis_public(text), public.signer_devis(text, text, text), public.refuser_devis(text, text),
  public.planning_contexte(text, text), public.planifier_apres_signature(text, text, text, timestamptz, timestamptz),
  public.signaler_a_planifier(text, text, text)
to anon, authenticated;
