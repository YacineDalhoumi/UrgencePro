import type { Metadata } from "next";
import { requireGerant } from "@/lib/auth";
import { comptesTechniciens, listerTechniciens } from "@/lib/donnees";
import { couleurTech, PALETTE } from "@/lib/format";
import { Alert, Card } from "@/components/ui";
import { CompteForm, TechnicienForm } from "./formulaires";

export const metadata: Metadata = { title: "Techniciens" };

export default async function PageTechniciens() {
  await requireGerant("/techniciens");
  let donnees: [
    Awaited<ReturnType<typeof listerTechniciens>>,
    Awaited<ReturnType<typeof comptesTechniciens>>,
  ];
  try {
    donnees = await Promise.all([listerTechniciens(), comptesTechniciens()]);
  } catch (e) {
    return (
      <Alert tone="bad" title="Techniciens indisponibles">
        {(e as Error).message}
      </Alert>
    );
  }
  const [techniciens, comptes] = donnees;
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
        Techniciens
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Chaque technicien a sa couleur dans l’agenda. Avec un compte, il voit
        son propre agenda et peut clôturer ses interventions.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {techniciens.map((t, i) => (
          <Card key={t.id} className="p-4">
            <TechnicienForm
              t={{
                id: t.id,
                nom: t.nom,
                telephone: t.telephone ?? "",
                couleur: couleurTech(t.couleur, i),
                competences: t.competences.join(", "),
                zone: t.zone.join(", "),
                disponible: t.disponible,
              }}
            />
            <div className="mt-4 border-t border-border pt-3">
              {comptes[t.id] ? (
                <p className="text-sm text-ok">Compte de connexion actif.</p>
              ) : (
                <CompteForm technicienId={t.id} />
              )}
            </div>
          </Card>
        ))}
        <Card className="border-dashed p-4">
          <h2 className="mb-3 font-display font-bold">Ajouter un technicien</h2>
          <TechnicienForm
            t={{
              id: "",
              nom: "",
              telephone: "",
              couleur: PALETTE[techniciens.length % PALETTE.length],
              competences: "",
              zone: "",
              disponible: true,
            }}
          />
        </Card>
      </div>
    </>
  );
}
