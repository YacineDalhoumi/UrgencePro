"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { annulerDemande, type Etat } from "@/app/(espace)/actions";

export function AnnulerForm({ demandeId }: { demandeId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState<Etat, FormData>(annulerDemande, null);
  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="text-sm font-semibold text-muted underline-offset-2 hover:text-bad hover:underline">
        Annuler cette demande
      </button>
    );
  }
  return (
    <form action={action} className="space-y-2 rounded-md border border-bad/30 bg-bad-soft/40 p-3">
      <input type="hidden" name="demande_id" value={demandeId} />
      {etat && !etat.ok && <Alert tone="bad">{etat.message}</Alert>}
      <label htmlFor="motif" className="text-sm font-semibold">
        Motif (facultatif)
      </label>
      <Input id="motif" name="motif" maxLength={300} placeholder="Ex. : le client a trouvé une autre solution" />
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={enCours}>
          {enCours ? "Annulation…" : "Confirmer l’annulation"}
        </Button>
        <Button variant="ghost" onClick={() => setOuvert(false)}>
          Garder la demande
        </Button>
      </div>
    </form>
  );
}
