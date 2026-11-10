import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mockMode, rateLimitPerMinute } from "@/lib/env";
import { appelerAgent, HTTP_STATUS, type PayloadN8n } from "@/lib/agent/n8n";
import { appelerAgentSimule } from "@/lib/agent/mock";
import { verifierLimite } from "@/lib/agent/rate-limit";
import { NouvelleDemandeSchema, type ApiReponse, type CodeErreur } from "@/lib/agent/types";

// Le workflow prend 10 à 30 s ; on attend jusqu'à 60 s (+ marge pour la plateforme d'hébergement).
export const maxDuration = 70;

const erreur = (code: CodeErreur, message: string, extra?: { details?: Record<string, string>; headers?: HeadersInit }) =>
  NextResponse.json<ApiReponse>({ ok: false, code, message, details: extra?.details }, { status: HTTP_STATUS[code], headers: extra?.headers });

/**
 * POST /api/agent/demandes — transmet une demande au workflow n8n AgentMultiUrgence.
 * Le navigateur n'appelle jamais n8n : l'URL et le secret restent sur le serveur.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return erreur("non_connecte", "Votre session a expiré. Reconnectez-vous.");
  if (!user.artisanId) return erreur("compte_non_active", "Ce compte n'est rattaché à aucune entreprise : demandez à l'administrateur de l'activer.");

  const limite = verifierLimite(user.id, rateLimitPerMinute());
  if (!limite.autorise) {
    return erreur("limite", `Trop de demandes envoyées. Réessayez dans ${limite.reessayerDansS} s.`, {
      headers: { "Retry-After": String(limite.reessayerDansS) },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return erreur("validation", "Requête illisible.");
  }
  const parsed = NouvelleDemandeSchema.safeParse(body);
  if (!parsed.success) {
    const details: Record<string, string> = {};
    for (const issue of parsed.error.issues) details[issue.path.join(".")] ??= issue.message;
    return erreur("validation", "Certains champs sont invalides.", { details });
  }
  const d = parsed.data;

  // Construction du corps attendu par n8n. L'artisan vient du compte connecté, jamais du navigateur.
  const payload: PayloadN8n = { message: d.message, artisan_id: user.artisanId };
  if (d.type_demande !== "auto") payload.type_demande = d.type_demande;
  if (d.client && Object.values(d.client).some(Boolean)) payload.client = d.client;
  if (d.type_demande === "rapport_facture" && d.intervention) {
    payload.intervention = {
      ...d.intervention,
      travaux: d.intervention.travaux.filter(Boolean),
      materiel: d.intervention.materiel.filter(Boolean),
    };
  }

  const simule = mockMode();
  const res = simule ? await appelerAgentSimule(payload) : await appelerAgent(payload);
  if (!res.ok) {
    console.error(`[agent] échec ${res.code} (HTTP n8n ${res.httpStatus ?? "-"}) après ${res.dureeMs} ms pour l'utilisateur ${user.id}`);
    return erreur(res.code, res.message);
  }
  return NextResponse.json<ApiReponse>({ ok: true, data: res.data, dureeMs: res.dureeMs, simule });
}
