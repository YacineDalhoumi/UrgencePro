import "server-only";
import { n8nConfig, ConfigError } from "@/lib/env";
import { ReponseAgentSchema, type CodeErreur, type ReponseAgent, type TypeDemande } from "./types";

/** Corps attendu par le webhook n8n (cf. nœud « Normaliser entree »). */
export interface PayloadN8n {
  message: string;
  type_demande?: TypeDemande;
  client?: { nom: string; telephone: string; email: string; adresse: string };
  intervention?: { date: string; technicien: string; constat: string; travaux: string[]; materiel: string[] };
  artisan_id: string;
}

export type ResultatAppel =
  | { ok: true; data: ReponseAgent; dureeMs: number }
  | { ok: false; code: CodeErreur; message: string; httpStatus?: number; dureeMs: number };

/**
 * Appelle le workflow n8n. Exécuté uniquement sur le serveur : l'URL et le secret
 * ne sont jamais envoyés au navigateur.
 */
export async function appelerAgent(payload: PayloadN8n): Promise<ResultatAppel> {
  const debut = Date.now();
  const duree = () => Date.now() - debut;
  let cfg: ReturnType<typeof n8nConfig>;
  try {
    cfg = n8nConfig();
  } catch (e) {
    return { ok: false, code: "config", message: e instanceof ConfigError ? e.message : "Configuration n8n invalide.", dureeMs: 0 };
  }

  let res: Response;
  try {
    res = await fetch(cfg.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-okto-key": cfg.secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(cfg.timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      return {
        ok: false,
        code: "timeout",
        message: `L'agent n'a pas répondu en ${Math.round(cfg.timeoutMs / 1000)} secondes. Le traitement continue peut-être dans n8n : vérifiez l'historique dans un instant avant de relancer.`,
        dureeMs: duree(),
      };
    }
    return { ok: false, code: "reseau", message: "Impossible de joindre le serveur n8n (réseau ou URL incorrecte).", dureeMs: duree() };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, code: "secret_refuse", httpStatus: res.status, message: "n8n a refusé le secret : vérifiez N8N_WEBHOOK_SECRET (en-tête x-okto-key).", dureeMs: duree() };
  }
  if (res.status === 404) {
    return { ok: false, code: "webhook_introuvable", httpStatus: 404, message: "Webhook introuvable : le workflow est peut-être désactivé, ou l'URL N8N_WEBHOOK_URL est incorrecte.", dureeMs: duree() };
  }
  if (!res.ok) {
    return {
      ok: false,
      code: "erreur_workflow",
      httpStatus: res.status,
      message: `Le workflow a échoué (HTTP ${res.status}). Une étape a peut-être planté (email, agenda ou enregistrement) : consultez les exécutions dans n8n.`,
      dureeMs: duree(),
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, code: "reponse_illisible", httpStatus: res.status, message: "La réponse de n8n n'est pas du JSON.", dureeMs: duree() };
  }
  const parsed = ReponseAgentSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, code: "reponse_illisible", httpStatus: res.status, message: "La réponse de n8n ne respecte pas le format attendu.", dureeMs: duree() };
  }
  return { ok: true, data: parsed.data, dureeMs: duree() };
}

/** Code HTTP renvoyé par notre route pour chaque erreur. */
export const HTTP_STATUS: Record<CodeErreur, number> = {
  non_connecte: 401,
  compte_non_active: 403,
  validation: 400,
  limite: 429,
  config: 500,
  timeout: 504,
  secret_refuse: 502,
  webhook_introuvable: 502,
  erreur_workflow: 502,
  reponse_illisible: 502,
  reseau: 502,
};
