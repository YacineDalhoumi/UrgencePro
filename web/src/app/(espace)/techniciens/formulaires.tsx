"use client";

import { useActionState } from "react";
import { KeyRound, Save, UserPlus } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { CopyButton } from "@/components/agent/CopyButton";
import { creerCompteTechnicien, enregistrerTechnicien, type Etat } from "../actions";

type T = { id: string; nom: string; telephone: string; couleur: string; competences: string; zone: string; disponible: boolean };

export function TechnicienForm({ t }: { t: T }) {
  const [etat, action, enCours] = useActionState<Etat, FormData>(enregistrerTechnicien, null);
  const p = t.id || "nouveau";
  return (
    <form action={action} className="space-y-3">
      {t.id && <input type="hidden" name="id" value={t.id} />}
      {etat && <Alert tone={etat.ok ? "ok" : "bad"}>{etat.message}</Alert>}
      <div className="flex items-end gap-3">
        <Field label="Nom" htmlFor={`${p}_nom`} className="flex-1">
          <Input id={`${p}_nom`} name="nom" defaultValue={t.nom} required />
        </Field>
        <Field label="Couleur" htmlFor={`${p}_couleur`}>
          <input id={`${p}_couleur`} name="couleur" type="color" defaultValue={t.couleur} className="h-11 w-14 cursor-pointer rounded-md border border-border bg-surface p-1" />
        </Field>
      </div>
      <Field label="Téléphone" htmlFor={`${p}_tel`}>
        <Input id={`${p}_tel`} name="telephone" type="tel" defaultValue={t.telephone} />
      </Field>
      <Field label="Compétences" htmlFor={`${p}_comp`} hint="Séparées par des virgules.">
        <Input id={`${p}_comp`} name="competences" defaultValue={t.competences} placeholder="ouverture de porte, changement de cylindre" />
      </Field>
      <Field label="Zones d’intervention" htmlFor={`${p}_zone`} hint="Séparées par des virgules.">
        <Input id={`${p}_zone`} name="zone" defaultValue={t.zone} placeholder="Paris, 92, 93" />
      </Field>
      {t.id && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="disponible" defaultChecked={t.disponible} className="size-4 accent-[var(--accent)]" /> Disponible pour de nouvelles interventions
        </label>
      )}
      <Button type="submit" variant={t.id ? "secondary" : "primary"} disabled={enCours}>
        {t.id ? <Save /> : <UserPlus />} {enCours ? "Enregistrement…" : t.id ? "Enregistrer" : "Ajouter"}
      </Button>
    </form>
  );
}

export function CompteForm({ technicienId }: { technicienId: string }) {
  const [etat, action, enCours] = useActionState<Etat, FormData>(creerCompteTechnicien, null);
  if (etat?.ok && etat.motDePasse) {
    return (
      <Alert tone="ok" title="Compte créé">
        <p>{etat.message}</p>
        <p className="mt-2 flex items-center gap-2">
          <code className="rounded bg-surface px-2 py-1 font-mono text-sm">{etat.motDePasse}</code>
          <CopyButton text={etat.motDePasse} />
        </p>
        <p className="mt-1 text-xs">Ce mot de passe ne sera plus affiché.</p>
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="technicien_id" value={technicienId} />
      {etat && !etat.ok && <Alert tone="bad">{etat.message}</Alert>}
      <label htmlFor={`${technicienId}_email`} className="text-sm font-semibold">
        Créer son compte de connexion
      </label>
      <div className="flex gap-2">
        <Input id={`${technicienId}_email`} name="email" type="email" placeholder="email du technicien" required />
        <Button type="submit" disabled={enCours}>
          <KeyRound /> {enCours ? "Création…" : "Créer"}
        </Button>
      </div>
    </form>
  );
}
