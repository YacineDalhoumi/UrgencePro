import "server-only";

/**
 * Limite d'appels par utilisateur, fenêtre glissante d'une minute.
 * Stockage en mémoire : suffisant pour une instance (démo, développement).
 * En production multi-instances (Vercel), remplacer par Upstash Redis ou une table Postgres.
 */
const appels = new Map<string, number[]>();
const FENETRE_MS = 60_000;

export function verifierLimite(cle: string, max: number): { autorise: boolean; restant: number; reessayerDansS: number } {
  const maintenant = Date.now();
  const recents = (appels.get(cle) ?? []).filter((t) => maintenant - t < FENETRE_MS);
  if (recents.length >= max) {
    appels.set(cle, recents);
    return { autorise: false, restant: 0, reessayerDansS: Math.ceil((FENETRE_MS - (maintenant - recents[0])) / 1000) };
  }
  recents.push(maintenant);
  appels.set(cle, recents);
  // Nettoyage occasionnel pour éviter que la table grossisse indéfiniment
  if (appels.size > 5000) for (const [k, v] of appels) if (!v.some((t) => maintenant - t < FENETRE_MS)) appels.delete(k);
  return { autorise: true, restant: max - recents.length, reessayerDansS: 0 };
}
