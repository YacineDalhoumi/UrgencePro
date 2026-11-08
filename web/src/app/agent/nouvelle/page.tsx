import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { NouvelleDemandeForm } from "@/components/agent/NouvelleDemandeForm";

export const metadata: Metadata = { title: "Nouvelle demande" };

export default async function PageNouvelleDemande() {
  const user = await requireUser("/agent/nouvelle");
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Nouvelle demande</h1>
      <p className="mb-6 mt-1 text-sm text-muted">L’agent IA classe la demande, la traite avec l’agent adapté, puis enregistre tout dans l’historique.</p>
      <NouvelleDemandeForm artisanId={user.artisanId} artisanIsDefault={user.artisanIsDefault} />
    </>
  );
}
