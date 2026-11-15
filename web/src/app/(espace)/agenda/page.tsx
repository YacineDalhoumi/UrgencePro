import type { Metadata } from "next";
import { requireArtisan } from "@/lib/auth";
import { interventionsEntre, listerTechniciens } from "@/lib/donnees";
import { FUSEAU, parisVersIso } from "@/lib/format";
import { Alert } from "@/components/ui";
import { AgendaVue } from "./vue";

export const metadata: Metadata = { title: "Agenda" };

/** Lundi (AAAA-MM-JJ) de la semaine contenant la date donnée. */
function lundi(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const jour = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - jour);
  return d.toISOString().slice(0, 10);
}
const plusJours = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default async function PageAgenda({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  const user = await requireArtisan("/agenda");
  const { semaine } = await searchParams;
  const aujourdhui = new Date().toLocaleDateString("sv-SE", {
    timeZone: FUSEAU,
  });
  const debutSemaine = lundi(
    /^\d{4}-\d{2}-\d{2}$/.test(semaine ?? "") ? semaine! : aujourdhui,
  );
  const jours = Array.from({ length: 7 }, (_, i) => plusJours(debutSemaine, i));

  let donnees: [
    Awaited<ReturnType<typeof interventionsEntre>>,
    Awaited<ReturnType<typeof listerTechniciens>>,
  ];
  try {
    donnees = await Promise.all([
      interventionsEntre(
        parisVersIso(debutSemaine, "00:00")!,
        parisVersIso(plusJours(debutSemaine, 7), "00:00")!,
      ),
      listerTechniciens(),
    ]);
  } catch (e) {
    return (
      <Alert tone="bad" title="Agenda indisponible">
        {(e as Error).message}
      </Alert>
    );
  }
  const [interventions, techniciens] = donnees;
  return (
    <AgendaVue
      role={user.role}
      technicienCourant={user.technicienId}
      jours={jours}
      aujourdhui={aujourdhui}
      precedente={plusJours(debutSemaine, -7)}
      suivante={plusJours(debutSemaine, 7)}
      interventions={interventions}
      techniciens={techniciens.map((t) => ({
        id: t.id,
        nom: t.nom,
        couleur: t.couleur,
        disponible: t.disponible,
      }))}
    />
  );
}
