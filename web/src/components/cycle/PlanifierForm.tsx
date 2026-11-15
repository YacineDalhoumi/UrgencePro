"use client";

import { useActionState } from "react";
import { CalendarPlus } from "lucide-react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { planifierManuellement, type Etat } from "@/app/(espace)/actions";

type Tech = { id: string; nom: string; disponible: boolean };

/** Planification à la main d'une demande au devis signé. */
export function PlanifierForm({ demandeId, techniciens, jourDefaut }: { demandeId: string; techniciens: Tech[]; jourDefaut: string }) {
  const [etat, action, enCours] = useActionState<Etat, FormData>(planifierManuellement, null);
  const dispo = techniciens.filter((t) => t.disponible);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="demande_id" value={demandeId} />
      {etat && <Alert tone={etat.ok ? "ok" : "bad"}>{etat.message}</Alert>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Technicien" htmlFor="pl_tech" className="col-span-2 sm:col-span-1">
          <Select id="pl_tech" name="technicien_id" required defaultValue={dispo[0]?.id}>
            {dispo.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="pl_date" className="col-span-2 sm:col-span-1">
          <Input id="pl_date" name="date" type="date" required defaultValue={jourDefaut} />
        </Field>
        <Field label="Début" htmlFor="pl_debut">
          <Input id="pl_debut" name="debut" type="time" required defaultValue="09:00" step={900} />
        </Field>
        <Field label="Fin" htmlFor="pl_fin">
          <Input id="pl_fin" name="fin" type="time" required defaultValue="10:30" step={900} />
        </Field>
      </div>
      <Button type="submit" variant="primary" className="h-12 w-full text-base sm:w-auto" disabled={enCours || !dispo.length}>
        <CalendarPlus /> {enCours ? "Enregistrement…" : "Planifier l’intervention"}
      </Button>
    </form>
  );
}
