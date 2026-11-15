import { after, NextResponse } from "next/server";
import { jetonValide } from "@/lib/jeton";
import { planifierApresSignature } from "@/lib/cycle";
import { lireJson } from "@/lib/api";
import { verifierLimite } from "@/lib/agent/rate-limit";

// La planification (agent planning puis confirmation au client) se poursuit après la réponse.
export const maxDuration = 120;

/**
 * POST /api/devis/planifier — appelé par la page publique juste après la signature.
 * Le client n'attend pas : la réponse part tout de suite, la planification continue en arrière-plan.
 * Sans effet si le devis n'est pas signé ou si la demande est déjà planifiée (contrôlé en base).
 */
export async function POST(request: Request) {
  const corps = (await lireJson(request)) as { jeton?: unknown } | null;
  const jeton = typeof corps?.jeton === "string" ? corps.jeton : "";
  if (!jetonValide(jeton)) return NextResponse.json({ ok: false }, { status: 400 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
  if (!verifierLimite(`planifier:${ip}`, 5).autorise) return NextResponse.json({ ok: false }, { status: 429 });

  after(async () => {
    try {
      const issue = await planifierApresSignature(jeton);
      console.log(`[planification] ${issue.statut}${"raison" in issue ? ` : ${issue.raison}` : ""}`);
    } catch (e) {
      console.error("[planification] échec :", (e as Error).message);
    }
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
