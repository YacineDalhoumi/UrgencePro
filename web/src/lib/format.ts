// Formats d'affichage et libellés du cycle de vie (utilisables côté client et serveur).
import type { Tone } from "@/components/ui";

export const FUSEAU = "Europe/Paris";

export const eur = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);

/** « 12 nov., 14:05 » */
export const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: FUSEAU });

/** « 12 novembre 2026 » */
export const dateLongue = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: FUSEAU });

/** « Jeudi 12 novembre » */
export const jourLong = (iso: string) => {
  const s = new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** « 9 h 30 » */
export const heureFr = (iso: string) => {
  const [h, m] = new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU }).split(":");
  return `${Number(h)} h ${m}`;
};

export const ETAPES = ["nouvelle", "devis_envoye", "devis_signe", "planifiee", "terminee", "refusee", "annulee"] as const;
export type Etape = (typeof ETAPES)[number];

export const ETAPE: Record<Etape, { label: string; tone: Tone }> = {
  nouvelle: { label: "Nouvelle", tone: "info" },
  devis_envoye: { label: "Devis envoyé", tone: "accent" },
  devis_signe: { label: "Devis signé", tone: "warn" },
  planifiee: { label: "Planifiée", tone: "info" },
  terminee: { label: "Terminée", tone: "ok" },
  refusee: { label: "Refusée", tone: "bad" },
  annulee: { label: "Annulée", tone: "neutral" },
};

export const etapeInfo = (e: string | null | undefined) => ETAPE[(e ?? "nouvelle") as Etape] ?? { label: e ?? "—", tone: "neutral" as Tone };

export const AUTEUR: Record<string, string> = { gerant: "Gérant", technicien: "Technicien", client: "Client", systeme: "Automatique" };

/** Couleur de repli d'un technicien sans couleur enregistrée. */
export const PALETTE = ["#2563eb", "#16a34a", "#9333ea", "#db2777", "#0891b2", "#ca8a04", "#dc2626", "#4f46e5"];
export const couleurTech = (couleur: string | null | undefined, index = 0) => couleur || PALETTE[index % PALETTE.length];

/**
 * Date + heure locales de Paris (« 2026-11-12 », « 09:30 ») → instant ISO (UTC).
 * Gère les changements d'heure : on cherche le décalage réel de Paris à cette date.
 */
export function parisVersIso(date: string, heure: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  const h = /^(\d{1,2}):(\d{2})/.exec(heure ?? "");
  if (!m || !h) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [hh, mm] = [Number(h[1]), Number(h[2])];
  if (hh > 23 || mm > 59) return null;
  const naif = Date.UTC(y, mo - 1, d, hh, mm);
  // Décalage de Paris à cet instant (approximation puis correction)
  const decalage = (t: number) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: FUSEAU, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(t));
    const v = (k: string) => Number(p.find((x) => x.type === k)?.value);
    return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute")) - t;
  };
  let t = naif - decalage(naif);
  t = naif - decalage(t);
  return new Date(t).toISOString();
}

/** Instant ISO → { date: « 2026-11-12 », heure: « 09:30 » } en heure de Paris. */
export function isoVersParis(iso: string): { date: string; heure: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("sv-SE", { timeZone: FUSEAU }),
    heure: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU }),
  };
}

/** Date de Paris (AAAA-MM-JJ), décalée de n jours. */
export const jourParis = (n = 0) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("sv-SE", { timeZone: FUSEAU });
