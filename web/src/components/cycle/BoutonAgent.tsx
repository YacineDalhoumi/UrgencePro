"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { Attente, TITRE_ERREUR, appelLong } from "@/components/Attente";
import type { ApiReponse } from "@/lib/agent/types";

/** Bouton qui relance un traitement de l'agent (devis ou facture), avec attente et message d'erreur clair. */
export function BoutonAgent({ url, libelle, attente }: { url: string; libelle: string; attente: string }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  const router = useRouter();
  if (enCours) return <Attente titre={attente} />;
  return (
    <div className="space-y-3">
      {erreur && (
        <Alert tone="bad" title={TITRE_ERREUR[erreur.code] ?? "Erreur"}>
          {erreur.message}
        </Alert>
      )}
      <Button
        variant="primary"
        className="h-12 w-full text-base sm:w-auto"
        onClick={async () => {
          setEnCours(true);
          setErreur(null);
          const r = (await appelLong<ApiReponse>(url)) as ApiReponse;
          setEnCours(false);
          if (!r.ok) setErreur(r);
          router.refresh();
        }}
      >
        <RotateCcw /> {libelle}
      </Button>
    </div>
  );
}
