"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Card } from "@/components/ui";

/** Attente d'un traitement long (agent IA) : message clair, durée habituelle, compteur. */
export function Attente({ titre, detail, dureeHabituelle = 20 }: { titre: string; detail?: string; dureeHabituelle?: number }) {
  const [ecoule, setEcoule] = useState(0);
  useEffect(() => {
    const debut = Date.now();
    const t = setInterval(() => setEcoule(Math.floor((Date.now() - debut) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Card className="p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" />
        </span>
        <div>
          <p className="font-display text-lg font-bold">{titre}</p>
          <p className="text-sm text-muted tnum">
            Environ {dureeHabituelle} secondes · {ecoule} s écoulée{ecoule > 1 ? "s" : ""}. Ne fermez pas la page.
          </p>
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sunken">
        <div className="progress-indeterminate h-full w-2/5 rounded-full bg-accent" />
      </div>
      {detail && <p className="mt-3 text-sm text-muted">{detail}</p>}
      {ecoule >= 45 && <p className="mt-3 text-sm text-warn">C’est plus long que d’habitude. L’attente maximale est d’une minute.</p>}
    </Card>
  );
}

export const TITRE_ERREUR: Record<string, string> = {
  timeout: "Délai dépassé",
  secret_refuse: "Service d’envoi indisponible",
  webhook_introuvable: "Service d’envoi indisponible",
  erreur_workflow: "L’envoi a échoué",
  reponse_illisible: "Document non produit",
  reseau: "Problème de connexion",
  limite: "Trop de demandes",
  config: "Configuration incomplète",
  non_connecte: "Session expirée",
  compte_non_active: "Accès refusé",
  base: "Enregistrement impossible",
  validation: "Formulaire incomplet",
};

/** Appel d'une route longue de l'application, avec un délai un peu supérieur à celui du serveur. */
export async function appelLong<T>(url: string, corps?: unknown): Promise<T | { ok: false; code: string; message: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corps ?? {}),
      signal: AbortSignal.timeout(80_000),
    });
    const json = (await res.json().catch(() => null)) as T | null;
    return json ?? { ok: false, code: "reponse_illisible", message: `Réponse inattendue du serveur (HTTP ${res.status}).` };
  } catch (err) {
    const timeout = (err as Error)?.name === "TimeoutError";
    return {
      ok: false,
      code: timeout ? "timeout" : "reseau",
      message: timeout ? "Pas de réponse après 80 secondes. Rechargez la fiche dans un instant avant de recommencer." : "Connexion au serveur impossible. Vérifiez votre réseau.",
    };
  }
}
