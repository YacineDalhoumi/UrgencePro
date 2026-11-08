"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { changerMotDePasse } from "./actions";

export function FormulaireMotDePasse() {
  const [etat, action, enCours] = useActionState(changerMotDePasse, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Nouveau mot de passe" htmlFor="mot_de_passe" hint="10 caractères minimum.">
        <Input id="mot_de_passe" name="mot_de_passe" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirmation" htmlFor="confirmation">
        <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      {etat.erreur && <Alert tone="bad">{etat.erreur}</Alert>}
      <Button type="submit" variant="primary" className="w-full" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
