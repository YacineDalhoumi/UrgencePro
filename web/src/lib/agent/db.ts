import "server-only";
import { mockMode } from "@/lib/env";
import { createAuthClient } from "@/lib/supabase/server";

/** Ligne de la table « demandes » (format utilisé par le mode simulé). */
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

/** Vérifie que la base répond avec la session de l'utilisateur (règles RLS appliquées). */
export async function testerBase(): Promise<{ ok: boolean; message: string }> {
  if (mockMode() && !process.env.NEXT_PUBLIC_SUPABASE_URL) return { ok: true, message: "Mode simulé : base non interrogée." };
  try {
    const db = await createAuthClient();
    const { count, error } = await db.from("demandes").select("id", { count: "exact", head: true });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: `${count ?? 0} demande(s) visibles pour votre entreprise.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
