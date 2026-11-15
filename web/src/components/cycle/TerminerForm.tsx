"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { Alert, Button, Card, Field, Textarea } from "@/components/ui";
import { Attente, TITRE_ERREUR, appelLong } from "@/components/Attente";
import type { ApiReponse } from "@/lib/agent/types";

const lignes = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

/** « Intervention terminée » : constat, travaux, matériel → rapport, facture et email au client. */
export function TerminerForm({ interventionId }: { interventionId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [constat, setConstat] = useState("");
  const [travaux, setTravaux] = useState("");
  const [materiel, setMateriel] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [reponse, setReponse] = useState<ApiReponse | null>(null);
  const router = useRouter();

  if (enCours) return <Attente titre="La facture est en cours de création" detail="Elle sera envoyée au client avec le rapport, un remerciement et le lien pour laisser un avis." />;

  if (!ouvert) {
    return (
      <Button variant="primary" className="h-12 w-full text-base sm:w-auto" onClick={() => setOuvert(true)}>
        <CircleCheck /> Intervention terminée
      </Button>
    );
  }
  const erreurs = reponse && !reponse.ok && reponse.code === "validation" ? (reponse.details ?? {}) : {};
  return (
    <Card className="border-accent/40 p-4">
      <form
        className="space-y-3"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setEnCours(true);
          setReponse(null);
          const r = (await appelLong<ApiReponse>(`/api/interventions/${interventionId}/terminer`, { constat, travaux: lignes(travaux), materiel: lignes(materiel) })) as ApiReponse;
          setEnCours(false);
          setReponse(r);
          router.refresh();
        }}
      >
        <h3 className="font-display font-bold">Compte rendu de l’intervention</h3>
        {reponse && !reponse.ok && (
          <Alert tone={reponse.code === "validation" ? "warn" : "bad"} title={TITRE_ERREUR[reponse.code] ?? "Erreur"}>
            {reponse.message}
          </Alert>
        )}
        <Field label="Constat" htmlFor="constat" error={erreurs.constat} hint="Ce que vous avez trouvé en arrivant.">
          <Textarea id="constat" value={constat} onChange={(e) => setConstat(e.target.value)} rows={3} required />
        </Field>
        <Field label="Travaux réalisés" htmlFor="travaux" hint="Un élément par ligne.">
          <Textarea id="travaux" value={travaux} onChange={(e) => setTravaux(e.target.value)} rows={3} />
        </Field>
        <Field label="Matériel posé" htmlFor="materiel" hint="Un élément par ligne.">
          <Textarea id="materiel" value={materiel} onChange={(e) => setMateriel(e.target.value)} rows={2} />
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="primary" className="h-12 text-base" disabled={constat.trim().length < 3}>
            <CircleCheck /> Valider et envoyer la facture
          </Button>
          <Button variant="ghost" onClick={() => setOuvert(false)}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}
