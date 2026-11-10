import type { Metadata } from "next";
import { requireArtisan } from "@/lib/auth";
import { Diagnostic } from "./diagnostic";

export const metadata: Metadata = { title: "Diagnostic" };

export default async function PageDiagnostic() {
  await requireArtisan("/agent/diagnostic");
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Diagnostic de la connexion</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Vérifie la configuration sans déclencher l’agent : aucun email, aucun événement d’agenda, aucune écriture.</p>
      <Diagnostic />
    </>
  );
}
