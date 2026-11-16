#!/usr/bin/env node
// Parcours complet dans un vrai navigateur : demande → devis → signature → planification → intervention terminée → facture.
//
// Prérequis :
//   1. entreprise de test créée : supabase/tests/e2e_preparer.sql (à exécuter dans l'éditeur SQL Supabase) ;
//   2. application lancée en mode simulé (n8n n'est pas appelé, la base est réelle) :
//        AGENT_MOCK=1 AGENT_MOCK_DELAY_MS=300 npm run build && npm start > /tmp/serveur.log
//   3. npm run test:e2e -- --journal /tmp/serveur.log   (le lien de signature est lu dans le journal du serveur)
// Ensuite : supabase/tests/e2e_nettoyer.sql supprime toutes les données de test.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = opt("--url", "http://localhost:3000");
const JOURNAL = opt("--journal", "/tmp/serveur.log");
const MDP = "E2e-Test-Parcours-2026";
const CAPTURES = opt("--captures", "");

let etape = 0;
const ok = (m) => console.log(`  \x1b[32m✔\x1b[0m ${++etape}. ${m}`);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined;
const navigateur = await chromium.launch({ proxy });
const nouveau = async (mobile = false) => {
  const ctx = await navigateur.newContext({ ignoreHTTPSErrors: true, viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("    [erreur page]", e.message));
  return { ctx, page };
};
const capture = async (page, nom) => CAPTURES && page.screenshot({ path: `${CAPTURES}/${nom}.png`, fullPage: true });

async function connexion(page, email) {
  await page.goto(`${BASE}/connexion`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', MDP);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL((u) => /^\/(tableau-de-bord|agenda|compte)/.test(u.pathname), { timeout: 20_000 });
}

try {
  console.log("\nParcours complet (n8n simulé, base réelle, entreprise ART-TEST-E2E)\n");

  // ——— Gérant : nouvelle demande ———
  const gerant = await nouveau();
  const g = gerant.page;
  await connexion(g, "gerant-e2e@test.invalid");
  if (!g.url().includes("/tableau-de-bord")) throw new Error(`le gérant arrive sur ${g.url()}`);
  ok("Gérant connecté, arrivé sur le tableau de bord");

  await g.goto(`${BASE}/demandes/nouvelle`);
  await g.fill("#client_nom", "Client Parcours E2E");
  await g.fill("#client_tel", "06 11 22 33 44");
  await g.fill("#client_email", "client-e2e@exemple.invalid");
  await g.fill("#client_adresse", "10 rue du Parcours, 75011 Paris");
  await g.fill("#message", "Remplacement du cylindre de la porte d'entrée, logement de plus de 2 ans.");
  await g.getByRole("button", { name: "Créer et envoyer le devis" }).click();
  await g.getByText("Le devis est en cours de création").waitFor({ timeout: 5000 });
  await g.waitForURL(/\/demandes\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await g.getByText("En attente de la signature du client").waitFor();
  const numeroDevis = (await g.locator("text=/DEV-\\d{4}-\\d{5}/").first().textContent()).match(/DEV-\d{4}-\d{5}/)[0];
  const ficheUrl = g.url().split("?")[0];
  await capture(g, "1-fiche-devis-envoye");
  ok(`Demande créée, devis ${numeroDevis} envoyé (étape « Devis envoyé »)`);

  // Lien de signature (jamais stocké en base) : lu dans le journal du serveur simulé
  let lien = null;
  for (let i = 0; i < 20 && !lien; i++) {
    const m = [...readFileSync(JOURNAL, "utf8").matchAll(new RegExp(`lien de signature ${numeroDevis} : (\\S+)`, "g"))].pop();
    lien = m?.[1] ?? null;
    if (!lien) await attendre(250);
  }
  if (!lien) throw new Error("lien de signature introuvable dans le journal du serveur");

  // ——— Client (téléphone, sans compte) : signature ———
  const client = await nouveau(true);
  const c = client.page;
  await c.goto(lien);
  await c.getByRole("heading", { name: `Devis ${numeroDevis}` }).waitFor();
  await c.getByText("Serrurerie Test E2E").first().waitFor();
  await capture(c, "2-page-signature");
  const bouton = c.getByRole("button", { name: "Signer" });
  if (await bouton.isEnabled()) throw new Error("le bouton Signer est actif sans acceptation");
  await c.getByLabel(/J’accepte le devis/).check();
  await c.fill("#sig_nom", "Client Parcours E2E");
  await c.locator("canvas").scrollIntoViewIfNeeded();
  const zone = await c.locator("canvas").boundingBox();
  await c.mouse.move(zone.x + 30, zone.y + 100);
  await c.mouse.down();
  for (let i = 1; i <= 12; i++) await c.mouse.move(zone.x + 30 + i * 22, zone.y + 100 + (i % 2 ? -35 : 35), { steps: 3 });
  await c.mouse.up();
  if (!(await bouton.isEnabled())) throw new Error("la signature tracée n'a pas activé le bouton Signer");
  await bouton.click();
  await c.getByText("Devis signé, merci !").waitFor({ timeout: 20_000 });
  await capture(c, "3-devis-signe");
  ok("Client : devis signé sur téléphone (case, nom, signature au doigt)");

  // ——— Planification automatique en arrière-plan ———
  let planifiee = false;
  for (let i = 0; i < 30 && !planifiee; i++) {
    await attendre(1000);
    await g.goto(ficheUrl);
    planifiee = (await g.getByText(/Intervention prévue/).count()) > 0;
  }
  if (!planifiee) throw new Error("la demande n'a pas été planifiée automatiquement");
  await g.getByText("Signé par Client Parcours E2E").first().waitFor();
  await capture(g, "4-fiche-planifiee");
  ok("Intervention planifiée automatiquement après la signature (preuve de signature visible)");

  // ——— Technicien : son agenda uniquement ———
  const tech = await nouveau(true);
  const t = tech.page;
  await connexion(t, "technicien-e2e@test.invalid");
  if (!t.url().includes("/agenda")) throw new Error(`le technicien arrive sur ${t.url()}`);
  await t.goto(`${BASE}/demandes`);
  if (!t.url().includes("/agenda")) throw new Error("un technicien accède à la liste des demandes");
  await t.goto(`${BASE}/agenda?semaine=${new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" })}`);
  const demain = new Date(Date.now() + 86_400_000).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", timeZone: "Europe/Paris" });
  await t.getByRole("button", { name: new RegExp(demain.replace(".", "\\.?"), "i") }).first().click();
  await t.getByRole("button", { name: /Client Parcours E2E/ }).first().waitFor({ timeout: 10_000 });
  await capture(t, "5-agenda-technicien");
  ok("Technicien : voit l'intervention dans son agenda, pas d'accès aux demandes");

  // ——— Intervention terminée → facture ———
  await t.getByRole("button", { name: /Client Parcours E2E/ }).first().click();
  await t.getByRole("button", { name: "Intervention terminée" }).click();
  await t.fill("#constat", "Cylindre usé, fermeture difficile.");
  await t.fill("#travaux", "Dépose de l'ancien cylindre\nPose d'un cylindre neuf");
  await t.fill("#materiel", "Cylindre européen 30/30");
  await t.getByRole("button", { name: "Valider et envoyer la facture" }).click();
  await t.getByText("La facture est en cours de création").waitFor({ timeout: 5000 });
  await t.getByText("Intervention terminée").first().waitFor({ timeout: 60_000 });
  ok("Technicien : intervention terminée, compte rendu saisi");

  await g.goto(ficheUrl);
  await g.getByText("Demande terminée").waitFor({ timeout: 10_000 });
  const facture = (await g.locator("text=/FAC-\\d{4}-\\d{6}/").first().textContent()).match(/FAC-\d{4}-\d{6}/)[0];
  const historique = await g.locator("main").textContent();
  for (const e of ["Nouvelle", "Devis envoyé", "Devis signé", "Planifiée", "Terminée"]) if (!historique.includes(e)) throw new Error(`historique incomplet (${e})`);
  await capture(g, "6-fiche-terminee");
  ok(`Facture ${facture} émise, demande « Terminée », historique horodaté complet`);

  // ——— Tableau de bord ———
  await g.goto(`${BASE}/tableau-de-bord`);
  await g.getByText("CA facturé TTC").first().waitFor();
  const tableau = await g.locator("main").textContent();
  if (!/159,50\s?€/.test(tableau)) throw new Error("le CA facturé n'apparaît pas au tableau de bord");
  if (!tableau.includes("100 %")) throw new Error("le taux de signature n'est pas de 100 %");
  await capture(g, "7-tableau-de-bord");
  ok("Tableau de bord : CA 159,50 €, taux de signature 100 %, 1 intervention terminée");

  // ——— Lien déjà signé : plus modifiable ———
  await c.goto(lien);
  if ((await c.getByRole("button", { name: "Signer" }).count()) > 0) throw new Error("un devis signé peut être signé à nouveau");
  ok("Le lien d'un devis signé n'affiche plus le formulaire de signature");

  console.log(`\n\x1b[32mParcours complet réussi (${etape} étapes).\x1b[0m\n`);
} catch (e) {
  console.error(`\n\x1b[31m✘ Échec à l'étape ${etape + 1} : ${e.message}\x1b[0m\n`);
  process.exitCode = 1;
} finally {
  await navigateur.close();
}
