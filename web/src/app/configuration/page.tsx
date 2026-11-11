import type { Metadata } from "next";
import { connection } from "next/server";
import { publiquesManquantes, serveurManquantes } from "@/lib/config-check";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Configuration incomplète" };

export default async function PageConfiguration() {
  await connection(); // évalué à chaque requête, jamais figé à la compilation
  const publiques = publiquesManquantes();
  const serveur = serveurManquantes();
  const tout = [...publiques, ...serveur];
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-2xl font-extrabold">Configuration incomplète</h1>
      {tout.length === 0 ? (
        <Alert tone="ok" className="mt-4" title="Toutes les variables sont présentes">
          Rechargez la page d’accueil.
        </Alert>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">L’application ne peut pas démarrer : il manque ces variables d’environnement sur le serveur.</p>
          <ul className="mt-4 space-y-1">
            {tout.map((v) => (
              <li key={v} className="rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm">
                {v}
              </li>
            ))}
          </ul>
          <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm">
            <li>
              Vercel → votre projet → <b>Settings → Environment Variables</b> : ajoutez chaque variable en cochant l’environnement <b>Production</b> (et <b>Preview</b> pour les branches).
            </li>
            <li>
              Onglet <b>Deployments</b> → menu « ⋯ » du dernier déploiement → <b>Redeploy</b>. Indispensable : les variables <code className="font-mono">NEXT_PUBLIC_…</code> sont intégrées au moment de la compilation.
            </li>
          </ol>
          {publiques.length > 0 && (
            <Alert tone="info" className="mt-6">
              Les valeurs à utiliser sont dans <code className="font-mono">web/.env.example</code> et <code className="font-mono">web/README.md</code>.
            </Alert>
          )}
        </>
      )}
    </main>
  );
}
