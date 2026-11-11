// Vérification des variables d'environnement (noms uniquement, jamais les valeurs).
// Sans les variables publiques Supabase, aucune page ne peut vérifier la session :
// on affiche alors une page d'explication au lieu d'une erreur 500.

export const VARIABLES_PUBLIQUES = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const;
export const VARIABLES_SERVEUR = ["N8N_WEBHOOK_URL", "N8N_WEBHOOK_SECRET", "AGENT_SUPABASE_URL", "AGENT_SUPABASE_SERVICE_KEY"] as const;

/** Variables publiques absentes. Écrit en accès littéral : Next.js les intègre au moment de la compilation. */
export function publiquesManquantes(): string[] {
  const manquantes: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) manquantes.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) manquantes.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return manquantes;
}

export function serveurManquantes(): string[] {
  return VARIABLES_SERVEUR.filter((v) => !process.env[v]?.trim());
}
