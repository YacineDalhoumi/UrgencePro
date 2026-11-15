import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireGerant } from "@/lib/auth";
import { NouvelleDemandeForm } from "@/components/agent/NouvelleDemandeForm";

export const metadata: Metadata = { title: "Nouvelle demande" };

export default async function PageNouvelleDemande() {
  await requireGerant("/demandes/nouvelle");
  return (
    <>
      <Link href="/demandes" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ChevronLeft className="size-4" /> Demandes
      </Link>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Nouvelle demande</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Le devis est préparé, numéroté et envoyé au client avec un lien pour le signer en ligne.</p>
      <NouvelleDemandeForm />
    </>
  );
}
