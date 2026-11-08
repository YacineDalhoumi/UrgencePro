import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mockMode, n8nConfig } from "@/lib/env";
import { testerBase } from "@/lib/agent/db";

/**
 * GET /api/agent/sante — vérifie la configuration sans déclencher l'agent :
 * 1) variables présentes ; 2) le webhook répond et refuse un faux secret (aucune exécution n8n) ;
 * 3) la table « demandes » est lisible.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "Non connecté." }, { status: 401 });

  const checks: { nom: string; ok: boolean; message: string }[] = [];
  if (mockMode()) checks.push({ nom: "Mode", ok: true, message: "Mode simulé actif (AGENT_MOCK=1) : n8n n'est pas appelé par les demandes." });

  try {
    const { url } = n8nConfig();
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-okto-key": "verification-sans-execution" },
        body: "{}",
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      const ok = r.status === 401 || r.status === 403;
      checks.push({
        nom: "Webhook n8n",
        ok,
        message: ok
          ? `Joignable, et il refuse bien un faux secret (HTTP ${r.status}).`
          : r.status === 404
            ? "HTTP 404 : workflow désactivé ou URL incorrecte."
            : `Réponse inattendue (HTTP ${r.status}) : le webhook est peut-être sans authentification.`,
      });
    } catch {
      checks.push({ nom: "Webhook n8n", ok: false, message: "Injoignable (réseau, DNS ou URL incorrecte)." });
    }
  } catch (e) {
    checks.push({ nom: "Configuration n8n", ok: false, message: (e as Error).message });
  }

  try {
    const base = await testerBase();
    checks.push({ nom: "Base Supabase de l'agent", ...base });
  } catch (e) {
    checks.push({ nom: "Base Supabase de l'agent", ok: false, message: (e as Error).message });
  }

  checks.push({
    nom: "Compte",
    ok: true,
    message: user.artisanIsDefault ? `Aucun artisan rattaché au compte : artisan de démonstration ${user.artisanId}.` : `Artisan rattaché : ${user.artisanId}.`,
  });

  return NextResponse.json({ ok: checks.every((c) => c.ok), checks });
}
