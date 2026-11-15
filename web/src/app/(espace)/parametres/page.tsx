import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { requireArtisan } from "@/lib/auth";
import { lireEntreprise } from "@/lib/donnees";
import { Card, CardTitle } from "@/components/ui";
import { Diagnostic } from "./diagnostic";
import { EntrepriseForm } from "./formulaire";

export const metadata: Metadata = { title: "Paramètres" };

export default async function PageParametres() {
  const user = await requireArtisan("/parametres");
  const entreprise = user.role === "gerant" ? await lireEntreprise() : null;
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Paramètres</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Compte : {user.email}</p>
      <div className="grid max-w-3xl grid-cols-1 gap-4">
        {entreprise && (
          <Card className="p-4">
            <h2 className="mb-1 font-display text-lg font-bold">Entreprise</h2>
            <p className="mb-4 text-sm text-muted">Ces informations apparaissent sur les devis, la page de signature et les emails.</p>
            <EntrepriseForm e={entreprise} />
          </Card>
        )}
        <Card>
          <CardTitle>Mot de passe</CardTitle>
          <div className="px-4 pb-4">
            <Link href="/compte/mot-de-passe" className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:bg-sunken">
              <KeyRound className="size-4" /> Changer mon mot de passe
            </Link>
          </div>
        </Card>
        {user.role === "gerant" && (
          <Card className="p-4">
            <h2 className="mb-1 font-display text-lg font-bold">Diagnostic</h2>
            <p className="mb-4 text-sm text-muted">Vérifie la configuration sans rien envoyer : aucun email, aucun rendez-vous, aucune écriture.</p>
            <Diagnostic />
          </Card>
        )}
      </div>
    </>
  );
}
