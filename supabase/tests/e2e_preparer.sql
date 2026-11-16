-- Prépare l'entreprise de test du parcours complet (ART-TEST-E2E). À exécuter avant `npm run test:e2e`.
-- Mots de passe de test uniquement (comptes @test.invalid, supprimés par e2e_nettoyer.sql).
do $$
declare
  g uuid := gen_random_uuid();
  t uuid := gen_random_uuid();
begin
  insert into public.artisans (id, entreprise, gerant, telephone, email, siret, adresse, zone_intervention, grille_tarifaire_ht, validite_devis_jours, lien_avis_google)
  values ('ART-TEST-E2E', 'Serrurerie Test E2E (FICTIVE)', 'Gérant Test', '01 00 00 00 99', 'e2e@test.invalid', '000 000 000 00099',
          '1 rue du Test, 75000 Paris', array['Paris'], '{"deplacement":49,"changement_cylindre_standard":{"min":120,"max":180}}', 30, 'https://exemple.invalid/avis-e2e');
  insert into public.techniciens (id, artisan_id, nom, competences, zone, disponible, couleur) values
    ('E2E-T1', 'ART-TEST-E2E', 'Alice Test', array['changement de cylindre'], array['Paris'], true, '#2563eb'),
    ('E2E-T2', 'ART-TEST-E2E', 'Bruno Test', array['ouverture de porte'], array['Paris'], true, '#16a34a');
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token, is_sso_user, is_anonymous)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
    extensions.crypt('E2e-Test-Parcours-2026', extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '', false, false
  from (values (g, 'gerant-e2e@test.invalid'), (t, 'technicien-e2e@test.invalid')) as u(id, email);
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now()
  from (values (g, 'gerant-e2e@test.invalid'), (t, 'technicien-e2e@test.invalid')) as u(id, email);
  insert into public.membres (user_id, artisan_id, role, technicien_id) values
    (g, 'ART-TEST-E2E', 'gerant', null), (t, 'ART-TEST-E2E', 'technicien', 'E2E-T1');
end $$;
