import type { Metadata } from "next";
import { CircleCheck, CircleX, Clock, Phone } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/server";
import { jetonValide } from "@/lib/jeton";
import { dateHeure, dateLongue } from "@/lib/format";
import { LigneSchema } from "@/lib/agent/types";
import { Alert, Card } from "@/components/ui";
import { TableLignes } from "@/components/agent/Resultat";
import { Signature } from "./signature";

export const metadata: Metadata = { title: "Votre devis", referrer: "no-referrer", robots: { index: false, follow: false } };

export interface DevisPublic {
  numero: string;
  statut: "envoye" | "signe" | "refuse" | "expire";
  entreprise: { nom: string; logo_url: string | null; telephone: string | null; email: string | null; adresse: string | null; siret: string | null };
  client: { nom: string | null; adresse: string | null };
  objet: string | null;
  lignes: unknown[];
  total_ht: number;
  tva_taux: number;
  montant_tva: number;
  total_ttc: number;
  emis_le: string | null;
  valide_jusqu: string;
  signe_at: string | null;
  signataire_nom: string | null;
  empreinte: string | null;
  refuse_at: string | null;
}

async function lire(token: string): Promise<DevisPublic | null> {
  if (!jetonValide(token)) return null;
  const { data, error } = await createAnonClient().rpc("devis_public", { p_token: token });
  if (error) throw new Error(error.message);
  return (data as DevisPublic | null) ?? null;
}

export default async function PageDevisPublic({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let d: DevisPublic | null = null;
  let indisponible = false;
  try {
    d = await lire(token);
  } catch {
    indisponible = true;
  }

  if (!d) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4 py-10">
        <Alert tone={indisponible ? "warn" : "bad"} title={indisponible ? "Service momentanément indisponible" : "Lien invalide"} className="w-full">
          {indisponible ? "Réessayez dans quelques minutes." : "Ce lien de devis n’existe pas ou n’est plus valable. Contactez l’entreprise qui vous l’a envoyé."}
        </Alert>
      </main>
    );
  }

  const e = d.entreprise;
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <header className="mb-5 flex items-center gap-3">
        {e.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.logo_url} alt={`Logo ${e.nom}`} className="size-14 rounded-md border border-border bg-white object-contain p-1" />
        ) : (
          <span className="inline-flex size-14 items-center justify-center rounded-md bg-ink font-display text-2xl font-extrabold text-ink-fg">{e.nom.charAt(0)}</span>
        )}
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{e.nom}</p>
          <p className="text-sm text-muted">{[e.adresse, e.telephone].filter(Boolean).join(" · ")}</p>
        </div>
      </header>

      <h1 className="font-display text-2xl font-extrabold">Devis {d.numero}</h1>
      <p className="mb-4 mt-1 text-sm text-muted">
        {d.client.nom ? `Pour ${d.client.nom}` : ""}
        {d.client.adresse ? ` · ${d.client.adresse}` : ""}
        {d.emis_le ? ` · émis le ${dateLongue(d.emis_le)}` : ""}
      </p>

      {d.objet && (
        <Card className="mb-4 p-4">
          <p className="label-caps mb-1 text-muted">Objet</p>
          <p className="whitespace-pre-line text-sm">{d.objet}</p>
        </Card>
      )}

      <Card className="mb-5 overflow-hidden">
        <TableLignes lignes={d.lignes.map((l) => LigneSchema.parse(l))} totaux={{ ht: Number(d.total_ht), taux: Number(d.tva_taux), tva: Number(d.montant_tva), ttc: Number(d.total_ttc) }} />
      </Card>

      {d.statut === "envoye" && (
        <>
          <p className="mb-4 flex items-center gap-2 text-sm text-muted">
            <Clock className="size-4" /> Devis valable jusqu’au {dateLongue(d.valide_jusqu)}.
          </p>
          <Signature token={token} totalTtc={Number(d.total_ttc)} />
        </>
      )}

      {d.statut === "signe" && (
        <Alert tone="ok" title="Devis signé, merci !">
          <p className="flex items-center gap-1.5">
            <CircleCheck className="size-4" /> Signé par {d.signataire_nom} le {dateHeure(d.signe_at!)}.
          </p>
          <p className="mt-1">{e.nom} vous contacte pour confirmer la date de l’intervention.</p>
          {d.empreinte && <p className="mt-2 break-all font-mono text-[11px] text-muted">Empreinte du document signé : {d.empreinte}</p>}
        </Alert>
      )}

      {d.statut === "refuse" && (
        <Alert tone="neutral" title="Devis refusé">
          <p className="flex items-center gap-1.5">
            <CircleX className="size-4" /> Vous avez refusé ce devis{d.refuse_at ? ` le ${dateHeure(d.refuse_at)}` : ""}.
          </p>
        </Alert>
      )}

      {d.statut === "expire" && (
        <Alert tone="warn" title="Ce devis a expiré">
          Il était valable jusqu’au {dateLongue(d.valide_jusqu)}. Contactez {e.nom} pour en obtenir un nouveau.
        </Alert>
      )}

      {e.telephone && (
        <a href={`tel:${e.telephone.replace(/\s/g, "")}`} className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-fg">
          <Phone className="size-4" /> Une question ? Appelez le {e.telephone}
        </a>
      )}
      {e.siret && <p className="mt-4 text-center text-xs text-muted">SIRET {e.siret}</p>}
    </main>
  );
}
