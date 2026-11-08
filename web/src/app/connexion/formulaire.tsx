"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { actionConnexion, type EtatConnexion } from "./actions";

export function FormulaireConnexion({ suivant, erreurInitiale }: { suivant: string; erreurInitiale?: string }) {
  const [oubli, setOubli] = useState(false);
  const [etat, action, enCours] = useActionState<EtatConnexion, FormData>(actionConnexion, { erreur: erreurInitiale });
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="suivant" value={suivant} />
      <input type="hidden" name="mode" value={oubli ? "oubli" : "connexion"} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      {!oubli && (
        <Field label="Mot de passe" htmlFor="mot_de_passe">
          <Input id="mot_de_passe" name="mot_de_passe" type="password" autoComplete="current-password" required />
        </Field>
      )}
      {etat.erreur && <Alert tone="bad">{etat.erreur}</Alert>}
      {etat.info && <Alert tone="ok">{etat.info}</Alert>}
      <Button type="submit" variant="primary" className="w-full" disabled={enCours}>
        {enCours ? "Patientez…" : oubli ? "Recevoir un lien" : "Se connecter"}
      </Button>
      <button type="button" onClick={() => setOubli(!oubli)} className="text-sm font-semibold text-accent hover:underline">
        {oubli ? "Retour à la connexion" : "Mot de passe oublié ?"}
      </button>
    </form>
  );
}
