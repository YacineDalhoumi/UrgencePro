import { describe, expect, it } from "vitest";
import { jetonValide, nouveauJeton, sha256Hex } from "@/lib/jeton";
import { etapeInfo, isoVersParis, parisVersIso } from "@/lib/format";
import { creneauxCandidats } from "@/lib/cycle";

describe("jeton de signature", () => {
  it("est aléatoire, au bon format, et seule son empreinte est stockée", () => {
    const a = nouveauJeton();
    const b = nouveauJeton();
    expect(a.jeton).not.toBe(b.jeton);
    expect(jetonValide(a.jeton)).toBe(true);
    expect(a.empreinte).toMatch(/^[0-9a-f]{64}$/);
    expect(a.empreinte).toBe(sha256Hex(a.jeton));
    expect(a.empreinte).not.toContain(a.jeton);
  });
  it("refuse les jetons mal formés", () => {
    expect(jetonValide("abc")).toBe(false);
    expect(jetonValide("x".repeat(43) + "/")).toBe(false);
    expect(jetonValide("../../etc/passwd")).toBe(false);
  });
  it("calcule la même empreinte SHA-256 que la base (app.empreinte)", () => {
    // Valeur de référence : select encode(sha256(convert_to('abc','UTF8')),'hex')
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("heures de Paris", () => {
  it("convertit l'heure d'hiver (UTC+1)", () => {
    expect(parisVersIso("2026-11-20", "09:30")).toBe("2026-11-20T08:30:00.000Z");
  });
  it("convertit l'heure d'été (UTC+2)", () => {
    expect(parisVersIso("2026-07-14", "14:00")).toBe("2026-07-14T12:00:00.000Z");
  });
  it("gère le jour du changement d'heure", () => {
    expect(parisVersIso("2026-10-25", "10:00")).toBe("2026-10-25T09:00:00.000Z");
    expect(parisVersIso("2026-03-29", "10:00")).toBe("2026-03-29T08:00:00.000Z");
  });
  it("refuse une saisie invalide", () => {
    expect(parisVersIso("20/11/2026", "09:30")).toBeNull();
    expect(parisVersIso("2026-11-20", "25:00")).toBeNull();
  });
  it("fait l'aller-retour", () => {
    expect(isoVersParis("2026-11-20T08:30:00.000Z")).toEqual({ date: "2026-11-20", heure: "09:30" });
  });
});

describe("créneaux proposés par l'agent planning", () => {
  it("prend le créneau principal puis les alternatives, en UTC", () => {
    const c = creneauxCandidats({
      action: "proposer",
      creneau_propose: { date: "2026-11-20", heure_debut: "09:00", heure_fin: "10:30", technicien_id: "TECH-01" },
      alternatives: [{ date: "2026-11-20", heure_debut: "14:00", technicien_id: "TECH-02" }, "texte libre ignoré"],
    });
    expect(c).toEqual([
      { technicien_id: "TECH-01", debut: "2026-11-20T08:00:00.000Z", fin: "2026-11-20T09:30:00.000Z" },
      { technicien_id: "TECH-02", debut: "2026-11-20T13:00:00.000Z", fin: "2026-11-20T14:30:00.000Z" },
    ]);
  });
  it("ignore une annulation, un créneau vide ou sans technicien", () => {
    expect(creneauxCandidats({ action: "annuler", creneau_propose: { date: "2026-11-20", heure_debut: "09:00", technicien_id: "T" } })).toEqual([]);
    expect(creneauxCandidats({ creneau_propose: null, alternatives: [] })).toEqual([]);
    expect(creneauxCandidats({ creneau_propose: { date: "2026-11-20", heure_debut: "09:00" } })).toEqual([]);
    expect(creneauxCandidats(null)).toEqual([]);
  });
});

describe("libellés des étapes", () => {
  it("affiche des libellés simples", () => {
    expect(etapeInfo("devis_envoye").label).toBe("Devis envoyé");
    expect(etapeInfo("planifiee").label).toBe("Planifiée");
    expect(etapeInfo(null).label).toBe("Nouvelle");
  });
});
