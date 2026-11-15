-- Supabase accorde par défaut EXECUTE aux rôles anon et authenticated sur les fonctions du schéma public
-- (privilèges par défaut, indépendants de PUBLIC). On retire explicitement l'accès anonyme
-- aux fonctions réservées aux utilisateurs connectés.
revoke execute on function
  public.creer_demande(text, jsonb, text, text), public.relancer_devis(uuid, text),
  public.enregistrer_devis(uuid, jsonb, jsonb, boolean, boolean), public.annuler_demande(uuid, text),
  public.planifier_manuellement(uuid, text, timestamptz, timestamptz),
  public.terminer_intervention(uuid, text, jsonb, jsonb), public.enregistrer_facture(uuid, jsonb, jsonb, boolean),
  public.creer_compte_technicien(text, text, text), public.tableau_de_bord(date, date)
from anon;
