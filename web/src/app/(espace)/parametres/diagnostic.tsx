"use client";

import { useState } from "react";
import { CircleCheck, CircleX, Stethoscope } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";

type Check = { nom: string; ok: boolean; message: string };

export function Diagnostic() {
  const [etat, setEtat] = useState<{ ok: boolean; checks: Check[] } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <div className="max-w-2xl space-y-4">
      <Button
        variant="primary"
        disabled={enCours}
        onClick={async () => {
          setEnCours(true);
          setErreur(null);
          try {
            const r = await fetch("/api/agent/sante", { cache: "no-store" });
            if (!r.ok && r.status === 401) throw new Error("Session expirée : reconnectez-vous.");
            setEtat(await r.json());
          } catch (e) {
            setErreur((e as Error).message || "Vérification impossible.");
          } finally {
            setEnCours(false);
          }
        }}
      >
        <Stethoscope /> {enCours ? "Vérification…" : "Tester la connexion"}
      </Button>
      {erreur && <Alert tone="bad">{erreur}</Alert>}
      {etat && (
        <Card>
          <ul className="divide-y divide-border">
            {etat.checks.map((c) => (
              <li key={c.nom} className="flex gap-3 px-4 py-3 text-sm">
                {c.ok ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" /> : <CircleX className="mt-0.5 size-5 shrink-0 text-bad" />}
                <div>
                  <div className="font-semibold">{c.nom}</div>
                  <div className="text-muted">{c.message}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
