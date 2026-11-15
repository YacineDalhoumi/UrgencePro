import { getCurrentUser } from "@/lib/auth";
import { rateLimitPerMinute } from "@/lib/env";
import { verifierLimite } from "@/lib/agent/rate-limit";
import { TerminerSchema } from "@/lib/agent/types";
import { terminerEtFacturer } from "@/lib/cycle";
import { erreurApi, lireJson, reponseIssue } from "@/lib/api";

export const maxDuration = 70;

/**
 * POST /api/interventions/:id/terminer — « Intervention terminée » : rapport, facture numérotée,
 * envoi au client (facture, remerciement, lien d'avis). Corps vide = nouvelle tentative de facturation.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/interventions/[id]/terminer">) {
  const user = await getCurrentUser();
  if (!user) return erreurApi("non_connecte", "Votre session a expiré. Reconnectez-vous.");
  if (!user.role) return erreurApi("compte_non_active", "Ce compte n'est rattaché à aucune entreprise.");
  const limite = verifierLimite(user.id, rateLimitPerMinute());
  if (!limite.autorise) return erreurApi("limite", `Trop de demandes envoyées. Réessayez dans ${limite.reessayerDansS} s.`);

  const { id } = await ctx.params;
  const corps = await lireJson(request);
  let saisie = null;
  if (corps && typeof corps === "object" && "constat" in corps) {
    const parsed = TerminerSchema.safeParse(corps);
    if (!parsed.success) {
      const details: Record<string, string> = {};
      for (const issue of parsed.error.issues) details[issue.path.join(".")] ??= issue.message;
      return erreurApi("validation", "Certains champs sont à compléter.", { details });
    }
    saisie = parsed.data;
  }
  return reponseIssue(await terminerEtFacturer(id, saisie));
}
