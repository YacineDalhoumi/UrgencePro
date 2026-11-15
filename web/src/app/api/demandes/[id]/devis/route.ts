import { getCurrentUser } from "@/lib/auth";
import { rateLimitPerMinute } from "@/lib/env";
import { verifierLimite } from "@/lib/agent/rate-limit";
import { relancerDevis } from "@/lib/cycle";
import { erreurApi, origine, reponseIssue } from "@/lib/api";

export const maxDuration = 70;

/** POST /api/demandes/:id/devis — nouvelle tentative de création du devis (après une erreur). */
export async function POST(request: Request, ctx: RouteContext<"/api/demandes/[id]/devis">) {
  const user = await getCurrentUser();
  if (!user) return erreurApi("non_connecte", "Votre session a expiré. Reconnectez-vous.");
  if (user.role !== "gerant") return erreurApi("compte_non_active", "Action réservée au gérant.");
  const limite = verifierLimite(user.id, rateLimitPerMinute());
  if (!limite.autorise) return erreurApi("limite", `Trop de demandes envoyées. Réessayez dans ${limite.reessayerDansS} s.`);
  const { id } = await ctx.params;
  return reponseIssue(await relancerDevis(id, origine(request)));
}
