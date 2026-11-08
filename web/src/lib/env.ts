import "server-only";

/**
 * Lecture centralisée des variables d'environnement serveur.
 * Aucune de ces valeurs n'est préfixée NEXT_PUBLIC_ : elles ne partent jamais dans le navigateur.
 */

export class ConfigError extends Error {}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ConfigError(`Variable d'environnement manquante : ${name}`);
  return value;
}

/** Configuration de l'appel au workflow n8n AgentMultiUrgence. */
export function n8nConfig() {
  return {
    url: required("N8N_WEBHOOK_URL"),
    secret: required("N8N_WEBHOOK_SECRET"),
    /** Délai maximal d'attente de la réponse du workflow (ms). */
    timeoutMs: Number(process.env.N8N_TIMEOUT_MS ?? 60_000),
  };
}

/** Configuration du projet Supabase dédié à l'agent (clé de service : serveur uniquement). */
export function agentDbConfig() {
  return {
    url: required("AGENT_SUPABASE_URL"),
    serviceKey: required("AGENT_SUPABASE_SERVICE_KEY"),
  };
}

/** Artisan utilisé quand le compte n'a pas encore d'artisan_id rattaché (mode démo). */
export const defaultArtisanId = () => process.env.AGENT_ARTISAN_ID?.trim() || "ART-DEMO-001";

/**
 * Contournement de l'authentification pour le développement local UNIQUEMENT (`next dev`).
 * Toujours inactif en production (NODE_ENV=production), même si la variable est définie.
 */
export const devAuthBypass = () => process.env.NODE_ENV === "development" && process.env.AUTH_DEV_BYPASS === "1";

/** Mode simulé : réponses fictives, aucun appel à n8n (développement et tests d'interface). */
export const mockMode = () => process.env.AGENT_MOCK === "1";

/** Limite d'appels à l'agent par utilisateur et par minute. */
export const rateLimitPerMinute = () => Number(process.env.AGENT_RATE_LIMIT_PER_MINUTE ?? 10);
