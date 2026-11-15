"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { Attente, TITRE_ERREUR, appelLong } from "@/components/Attente";
import type { ApiReponse } from "@/lib/agent/types";

const EXEMPLES: { label: string; message: string; client: Record<"nom" | "telephone" | "email" | "adresse", string> }[] = [
  {
    label: "Changement de cylindre",
    message: "Remplacer le cylindre de la porte d'entrée (cylindre européen standard). Logement de plus de 10 ans, intervention en semaine.",
    client: { nom: "Paul Durand (fictif)", telephone: "06 39 98 55 10", email: "paul.durand@example.com", adresse: "8 rue Imaginaire, 93100 Montreuil" },
  },
  {
    label: "Serrure 3 points",
    message: "Pose d'une serrure 3 points sur porte palière après tentative d'effraction. Appartement de plus de 2 ans.",
    client: { nom: "Claire Martin (fictive)", telephone: "06 39 98 12 34", email: "claire.martin@example.com", adresse: "12 avenue Fictive, 93200 Saint-Denis" },
  },
];

const vide = { nom: "", telephone: "", email: "", adresse: "" };

/** Nouvelle demande : le devis est créé, numéroté et envoyé au client avec son lien de signature. */
export function NouvelleDemandeForm() {
  const [message, setMessage] = useState("");
  const [client, setClient] = useState(vide);
  const [enCours, setEnCours] = useState(false);
  const [reponse, setReponse] = useState<ApiReponse | null>(null);
  const router = useRouter();

  const erreurs = reponse && !reponse.ok && reponse.code === "validation" ? (reponse.details ?? {}) : {};

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (enCours) return;
    setEnCours(true);
    setReponse(null);
    const r = (await appelLong<ApiReponse>("/api/agent/demandes", { message, client, canal: "email" })) as ApiReponse;
    if (r.ok) {
      router.push(`/demandes/${r.demandeId}?cree=1`);
      return;
    }
    if (r.code === "non_connecte") router.push("/connexion?suivant=/demandes/nouvelle");
    setReponse(r);
    setEnCours(false);
  }

  if (enCours) {
    return (
      <div className="max-w-2xl">
        <Attente titre="Le devis est en cours de création" detail="Il sera ensuite envoyé au client par email, avec son lien de signature." />
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="max-w-2xl space-y-4" noValidate>
      {reponse && !reponse.ok && (
        <Alert tone={reponse.code === "validation" ? "warn" : "bad"} title={TITRE_ERREUR[reponse.code] ?? "Erreur"}>
          <p>{reponse.message}</p>
          {reponse.demandeId && (
            <Link href={`/demandes/${reponse.demandeId}`} className="mt-1 inline-block font-semibold underline">
              Ouvrir la demande
            </Link>
          )}
        </Alert>
      )}

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-muted">
          <Sparkles className="size-4" /> Exemples
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXEMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => {
                setMessage(ex.message);
                setClient(ex.client);
              }}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:border-accent hover:text-fg"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        <h2 className="font-display font-bold sm:col-span-2">Client</h2>
        <Field label="Nom" htmlFor="client_nom" error={erreurs["client.nom"]}>
          <Input id="client_nom" value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} autoComplete="off" required />
        </Field>
        <Field label="Téléphone" htmlFor="client_tel" error={erreurs["client.telephone"]}>
          <Input id="client_tel" type="tel" inputMode="tel" value={client.telephone} onChange={(e) => setClient({ ...client, telephone: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Email" htmlFor="client_email" error={erreurs["client.email"]} hint="Le devis et le lien de signature sont envoyés à cette adresse." className="sm:col-span-2">
          <Input id="client_email" type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} autoComplete="off" required />
        </Field>
        <Field label="Adresse d’intervention" htmlFor="client_adresse" error={erreurs["client.adresse"]} className="sm:col-span-2">
          <Input id="client_adresse" value={client.adresse} onChange={(e) => setClient({ ...client, adresse: e.target.value })} autoComplete="off" required />
        </Field>
      </Card>

      <Field label="Travaux demandés" htmlFor="message" error={erreurs.message} hint="Ce que veut le client : le devis est préparé à partir de votre grille tarifaire.">
        <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} required placeholder="Ex. : remplacer le cylindre de la porte d’entrée, logement de plus de 2 ans…" />
      </Field>

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="submit" variant="primary" className="h-12 w-full text-base" disabled={message.trim().length < 5}>
          <Send /> Créer et envoyer le devis
        </Button>
      </div>
    </form>
  );
}
