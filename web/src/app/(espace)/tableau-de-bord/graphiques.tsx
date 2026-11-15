"use client";

import { useState } from "react";
import { couleurTech, eur } from "@/lib/format";

const libellePeriode = (iso: string, pas: "week" | "month") =>
  pas === "month"
    ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" })
    : new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Graduation « ronde » de l'axe des montants. */
function graduations(max: number): number[] {
  if (max <= 0) return [0];
  const brut = max / 4;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= brut) ?? brut;
  return Array.from({ length: Math.ceil(max / pas) + 1 }, (_, i) => i * pas);
}
const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)} k€` : `${n.toLocaleString("fr-FR")} €`);

/** CA facturé par semaine ou par mois (une seule série : pas de légende, le titre la nomme). */
export function GraphiqueCa({ points, pas }: { points: { debut: string; ca_ttc: number }[]; pas: "week" | "month" }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const max = Math.max(0, ...points.map((p) => Number(p.ca_ttc)));
  const ticks = graduations(max);
  const haut = ticks[ticks.length - 1] || 1;
  const H = 180;
  const total = points.reduce((s, p) => s + Number(p.ca_ttc), 0);

  if (total === 0) return <p className="mt-6 text-sm text-muted">Aucune facture émise sur la période.</p>;

  return (
    <figure className="mt-3">
      <div className="relative flex gap-2" style={{ height: H + 24 }}>
        <div className="relative w-12 shrink-0 text-right text-[11px] text-muted tnum" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: H - (t / haut) * H }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-border" style={{ top: H - (t / haut) * H }} />
          ))}
          <div className="absolute inset-x-0 top-0 flex items-end justify-around gap-[2px]" style={{ height: H }}>
            {points.map((p, i) => {
              const v = Number(p.ca_ttc);
              return (
                <button
                  key={p.debut}
                  type="button"
                  className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-none"
                  onMouseEnter={() => setSurvol(i)}
                  onMouseLeave={() => setSurvol(null)}
                  onFocus={() => setSurvol(i)}
                  onBlur={() => setSurvol(null)}
                  aria-label={`${libellePeriode(p.debut, pas)} : ${eur(v)}`}
                >
                  <span className={`block w-full max-w-6 rounded-t bg-accent transition-opacity ${survol !== null && survol !== i ? "opacity-50" : ""}`} style={{ height: Math.max(v > 0 ? 2 : 0, (v / haut) * H) }} />
                  {survol === i && (
                    <span className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-md" style={{ bottom: (v / haut) * H + 4 }}>
                      <span className="block text-muted">{pas === "month" ? libellePeriode(p.debut, pas) : `Semaine du ${libellePeriode(p.debut, pas)}`}</span>
                      <span className="font-semibold tnum">{eur(v)}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="absolute inset-x-0 flex justify-around text-[11px] text-muted" style={{ top: H + 6 }} aria-hidden>
            {points.map((p, i) => (
              <span key={p.debut} className="flex-1 truncate text-center">
                {points.length > 8 && i % 2 ? "" : libellePeriode(p.debut, pas)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-muted">Voir les montants</summary>
        <table className="mt-1 w-full text-xs tnum">
          <tbody>
            {points.map((p) => (
              <tr key={p.debut} className="border-t border-border">
                <td className="py-1">{pas === "month" ? libellePeriode(p.debut, pas) : `Semaine du ${libellePeriode(p.debut, pas)}`}</td>
                <td className="py-1 text-right">{eur(p.ca_ttc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Interventions par technicien (couleur = celle du technicien dans l'agenda, nom écrit à côté). */
export function GraphiqueTechniciens({ lignes }: { lignes: { technicien_id: string; nom: string; couleur: string | null; terminees: number; planifiees: number }[] }) {
  const max = Math.max(1, ...lignes.map((l) => l.terminees + l.planifiees));
  if (!lignes.length) return <p className="mt-6 text-sm text-muted">Aucun technicien.</p>;
  return (
    <ul className="mt-4 space-y-3">
      {lignes.map((l, i) => {
        const total = l.terminees + l.planifiees;
        return (
          <li key={l.technicien_id} title={`${l.nom} : ${l.terminees} terminée(s), ${l.planifiees} prévue(s)`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-semibold">{l.nom}</span>
              <span className="shrink-0 text-xs text-muted tnum">
                {l.terminees} terminée{l.terminees > 1 ? "s" : ""} · {l.planifiees} prévue{l.planifiees > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex h-3 gap-[2px]" aria-hidden>
              {l.terminees > 0 && <span className={l.planifiees ? "" : "rounded-r"} style={{ width: `${(l.terminees / max) * 100}%`, background: couleurTech(l.couleur, i) }} />}
              {l.planifiees > 0 && (
                <span className="rounded-r" style={{ width: `${(l.planifiees / max) * 100}%`, background: `color-mix(in srgb, ${couleurTech(l.couleur, i)} 35%, var(--surface))` }} />
              )}
              {total === 0 && <span className="h-px w-full self-center bg-border" />}
            </div>
          </li>
        );
      })}
      <li className="flex gap-4 pt-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-fg/70" /> terminées
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-fg/25" /> prévues
        </span>
      </li>
    </ul>
  );
}
