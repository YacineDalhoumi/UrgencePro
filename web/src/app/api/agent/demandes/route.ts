import { getCurrentUser, type ArtisanUser } from "@/lib/auth";
import { rateLimitPerMinute } from "@/lib/env";
import { verifierLimite } from "@/lib/agent/rate-limit";
import { NouvelleDemandeSchema } from "@/lib/agent/types";
import { creerDemandeEtDevis } from "@/lib/cycle";
import { erreurApi, lireJson, origine, reponseIssue } from "@/lib/api";

// Le workflow prend 10 à 30 s ; on attend jusqu'à 60 s (+ marge pour la plateforme d'hébergement).
export const maxDuration = 70;

/**
 * POST /api/agent/demandes — nouvelle demande d'un gérant : fiche client, demande, devis numéroté,
 * puis appel du workflow n8n (type « devis ») qui envoie le PDF et le lien de signature au client.
 * Le navigateur n'appelle jamais n8n : l'URL et le secret restent sur le serveur.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return erreurApi("non_connecte", "Votre session a expiré. Reconnectez-vous.");
  if (!user.artisanId || user.role !== "gerant") return erreurApi("compte_non_active", "Seul le gérant de l'entreprise peut créer une demande.");

  const limite = verifierLimite(user.id, rateLimitPerMinute());
  if (!limite.autorise) {
    return erreurApi("limite", `Trop de demandes envoyées. Réessayez dans ${limite.reessayerDansS} s.`, { headers: { "Retry-After": String(limite.reessayerDansS) } });
  }

  const parsed = NouvelleDemandeSchema.safeParse(await lireJson(request));
  if (!parsed.success) {
    const details: Record<string, string> = {};
    for (const issue of parsed.error.issues) details[issue.path.join(".")] ??= issue.message;
    return erreurApi("validation", "Certains champs sont à compléter.", { details });
  }
  const issue = await creerDemandeEtDevis(user as ArtisanUser, parsed.data, origine(request));
  if (!issue.ok) console.error(`[demandes] ${issue.code} pour l'utilisateur ${user.id} : ${issue.message}`);
  return reponseIssue(issue);
}
