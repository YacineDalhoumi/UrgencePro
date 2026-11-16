-- Supprime tout ce que le parcours complet a créé (ART-TEST-E2E). Le verrou des devis signés
-- et des factures émises est levé uniquement pour cette transaction (app.purge_test).
begin;
select set_config('app.purge_test', 'on', true);
delete from public.demandes where artisan_id = 'ART-TEST-E2E';
delete from public.artisans where id = 'ART-TEST-E2E';
delete from auth.users where email in ('gerant-e2e@test.invalid', 'technicien-e2e@test.invalid');
commit;
