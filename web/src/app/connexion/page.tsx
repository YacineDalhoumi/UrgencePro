import type { Metadata } from "next";
import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({ searchParams }: { searchParams: Promise<{ suivant?: string; erreur?: string }> }) {
  const { suivant, erreur } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-md bg-accent font-display text-lg font-extrabold text-accent-fg">U</span>
          <span className="font-display text-xl font-bold">UrgencePro</span>
        </div>
        <h1 className="font-display text-2xl font-extrabold">Connexion</h1>
        <p className="mt-1 text-sm text-muted">Accès réservé aux comptes créés par l’administrateur.</p>
        <FormulaireConnexion suivant={suivant ?? "/agent/nouvelle"} erreurInitiale={erreur === "lien" ? "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau." : undefined} />
      </div>
    </main>
  );
}
