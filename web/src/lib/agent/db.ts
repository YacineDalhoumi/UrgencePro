import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { agentDbConfig, mockMode } from "@/lib/env";
import { TYPES_DEMANDE } from "./types";
import { demandesSimulees } from "./mock";

/** Ligne de la table « demandes » du projet Supabase AgentMultiUrgence. */
export interface DemandeRow {
  id: string;
  reference: string | null;
  artisan_id: string | null;
  client_id: string | null;
  client_nom: string | null;
  client_telephone: string | null;
  client_email: string | null;
  message: string | null;
  type_demande: string | null;
  routage: { confiance?: number | null; raison?: string } | null;
  resultat: Record<string, unknown> | null;
  actions: Record<string, unknown> | null;
  statut: string | null;
  donnees_fictives: boolean | null;
  created_at: string;
}

let client: SupabaseClient | null = null;

/** Client « service » du projet de l'agent : contourne la RLS, donc strictement côté serveur. */
function agentDb(): SupabaseClient {
  if (!client) {
    const { url, serviceKey } = agentDbConfig();
    // Les clés secrètes récentes (sb_secret_…) s'envoient uniquement dans l'en-tête « apikey »,
    // jamais comme jeton Bearer : on retire l'en-tête Authorization que le client ajoute par défaut.
    const nouvelleCle = serviceKey.startsWith("sb_");
    client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: nouvelleCle
        ? {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (headers.get("Authorization") === `Bearer ${serviceKey}`) headers.delete("Authorization");
              return fetch(input, { ...init, headers });
            },
          }
        : undefined,
    });
  }
  return client;
}

const utiliserSimulation = () => mockMode() && !process.env.AGENT_SUPABASE_URL;

export const PAGE_TAILLE = 20;

export interface FiltresHistorique {
  artisanId: string;
  type?: string;
  statut?: string;
  page?: number;
}

/** Historique d'un artisan, du plus récent au plus ancien. Toujours filtré sur l'artisan du compte. */
export async function listerDemandes(f: FiltresHistorique): Promise<{ lignes: DemandeRow[]; total: number }> {
  const page = Math.max(1, f.page ?? 1);
  const type = f.type && (TYPES_DEMANDE as readonly string[]).includes(f.type) ? f.type : undefined;
  const statut = f.statut && ["traite", "erreur"].includes(f.statut) ? f.statut : undefined;

  if (utiliserSimulation()) {
    const toutes = demandesSimulees(f.artisanId).filter((d) => (!type || d.type_demande === type) && (!statut || d.statut === statut));
    return { lignes: toutes.slice((page - 1) * PAGE_TAILLE, page * PAGE_TAILLE), total: toutes.length };
  }

  let q = agentDb()
    .from("demandes")
    .select("id, reference, artisan_id, client_nom, client_telephone, client_email, message, type_demande, statut, donnees_fictives, created_at", { count: "exact" })
    .eq("artisan_id", f.artisanId)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_TAILLE, page * PAGE_TAILLE - 1);
  if (type) q = q.eq("type_demande", type);
  if (statut) q = q.eq("statut", statut);
  const { data, error, count } = await q;
  if (error) throw new Error(`Lecture de l'historique impossible : ${error.message}`);
  return { lignes: (data ?? []) as DemandeRow[], total: count ?? 0 };
}

/** Fiche d'une demande, uniquement si elle appartient à l'artisan du compte. */
export async function lireDemande(id: string, artisanId: string): Promise<DemandeRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (utiliserSimulation()) return demandesSimulees(artisanId).find((d) => d.id === id) ?? null;
  const { data, error } = await agentDb().from("demandes").select("*").eq("id", id).eq("artisan_id", artisanId).maybeSingle();
  if (error) throw new Error(`Lecture de la demande impossible : ${error.message}`);
  return data as DemandeRow | null;
}

/** Vérifie que la base de l'agent répond (utilisé par la route de santé). */
export async function testerBase(): Promise<{ ok: boolean; message: string }> {
  if (utiliserSimulation()) return { ok: true, message: "Mode simulé : base non interrogée." };
  try {
    const { count, error } = await agentDb().from("demandes").select("id", { count: "exact", head: true });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: `${count ?? 0} demande(s) dans la table.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
