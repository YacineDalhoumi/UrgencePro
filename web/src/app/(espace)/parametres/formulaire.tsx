"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { enregistrerEntreprise, type Etat } from "../actions";
import type { Entreprise } from "@/lib/donnees";

export function EntrepriseForm({ e }: { e: Entreprise }) {
  const [etat, action, enCours] = useActionState<Etat, FormData>(enregistrerEntreprise, null);
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {etat && (
        <Alert tone={etat.ok ? "ok" : "bad"} className="sm:col-span-2">
          {etat.message}
        </Alert>
      )}
      <Field label="Nom de l’entreprise" htmlFor="ent_nom" className="sm:col-span-2">
        <Input id="ent_nom" name="entreprise" defaultValue={e.entreprise} required />
      </Field>
      <Field label="Téléphone" htmlFor="ent_tel">
        <Input id="ent_tel" name="telephone" type="tel" defaultValue={e.telephone ?? ""} />
      </Field>
      <Field label="Email" htmlFor="ent_email">
        <Input id="ent_email" name="email" type="email" defaultValue={e.email ?? ""} />
      </Field>
      <Field label="Adresse" htmlFor="ent_adresse" className="sm:col-span-2">
        <Input id="ent_adresse" name="adresse" defaultValue={e.adresse ?? ""} />
      </Field>
      <Field label="SIRET" htmlFor="ent_siret">
        <Input id="ent_siret" name="siret" defaultValue={e.siret ?? ""} />
      </Field>
      <Field label="Validité des devis (jours)" htmlFor="ent_validite">
        <Input id="ent_validite" name="validite_devis_jours" type="number" min={1} max={365} defaultValue={e.validite_devis_jours ?? 30} required />
      </Field>
      <Field label="Lien pour laisser un avis Google" htmlFor="ent_avis" hint="Envoyé au client avec la facture." className="sm:col-span-2">
        <Input id="ent_avis" name="lien_avis_google" type="url" defaultValue={e.lien_avis_google ?? ""} placeholder="https://g.page/r/…/review" />
      </Field>
      <Field label="Adresse du logo" htmlFor="ent_logo" hint="Image affichée sur la page de signature (lien https)." className="sm:col-span-2">
        <Input id="ent_logo" name="logo_url" type="url" defaultValue={e.logo_url ?? ""} placeholder="https://…/logo.png" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" disabled={enCours}>
          <Save /> {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
