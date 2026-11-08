import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { lireDemande } from "@/lib/agent/db";
import { Alert, Card, CardTitle } from "@/components/ui";
import { ResultatAgent } from "@/components/agent/Resultat";

export const metadata: Metadata = { title: "Demande" };

export default async function PageDemande({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/agent/historique/${id}`);
  let d: Awaited<ReturnType<typeof lireDemande>>;
  try {
    d = await lireDemande(id, user.artisanId);
  } catch (e) {
    return (
      <Alert tone="bad" title="Demande indisponible">
        {(e as Error).message}
      </Alert>
    );
  }
  if (!d) notFound();
  return (
    <>
      <Link href="/agent/historique" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ChevronLeft className="size-4" /> Historique
      </Link>
      <h1 className="font-display text-2xl font-extrabold">Demande {d.reference}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Reçue le {new Date(d.created_at).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" })}
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardTitle>Demande</CardTitle>
            <p className="whitespace-pre-line px-4 pb-4 text-sm">{d.message}</p>
          </Card>
          <Card>
            <CardTitle>Client</CardTitle>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-4 pb-4 text-sm">
              <dt className="text-muted">Nom</dt>
              <dd>{d.client_nom || "—"}</dd>
              <dt className="text-muted">Téléphone</dt>
              <dd className="tnum">{d.client_telephone || "—"}</dd>
              <dt className="text-muted">Email</dt>
              <dd className="break-all">{d.client_email || "—"}</dd>
            </dl>
          </Card>
        </div>
        <div className="min-w-0">
          <ResultatAgent
            success={d.statut !== "erreur"}
            reference={d.reference}
            typeDemande={d.type_demande}
            resultat={d.resultat}
            actions={d.actions}
            donneesFictives={d.donnees_fictives}
            routage={d.routage}
          />
        </div>
      </div>
    </>
  );
}
