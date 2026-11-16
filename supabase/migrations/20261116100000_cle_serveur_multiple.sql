-- La planification après signature accepte plusieurs clés serveur (lignes « cle_serveur… » de app.secrets) :
-- APP_CLE_SERVEUR quand elle est définie, sinon le secret du webhook n8n déjà présent côté serveur.
-- Seules les empreintes SHA-256 sont stockées.
create or replace function app.cle_serveur_valide(p_cle text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_cle) >= 20, false)
     and exists (select 1 from app.secrets s where s.nom like 'cle_serveur%' and s.valeur_hash = app.empreinte(p_cle))
$$;
revoke execute on function app.cle_serveur_valide(text) from public;
