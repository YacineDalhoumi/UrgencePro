#!/usr/bin/env node
// Test de connexion au workflow n8n AgentMultiUrgence et à sa base Supabase.
//
//   npm run test:agent                 → vérifications SANS effet (aucune exécution n8n)
//   npm run test:agent -- --complet    → + une vraie demande « communication »
//   npm run test:agent -- --complet devis
//   npm run test:agent -- --tous       → + une vraie demande de chaque type (5 appels)
//
// Attention : un appel réel exécute le workflow (appels IA facturés, email de démo envoyé,
// événement Google Agenda créé pour « planning », ligne ajoutée dans la table demandes).

import { existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

const args = process.argv.slice(2);
const tous = args.includes("--tous");
const complet = tous || args.includes("--complet");
const typeArg = args.find((a) => !a.startsWith("--"));
const TYPES = ["prise_en_charge", "devis", "rapport_facture", "communication", "planning"];

const ok = (m) => console.log(`  \x1b[32m✔\x1b[0m ${m}`);
const ko = (m) => console.log(`  \x1b[31m✘\x1b[0m ${m}`);
let echecs = 0;
const echec = (m) => {
  echecs++;
  ko(m);
};

console.log("\n1. Variables d'environnement");
for (const v of ["N8N_WEBHOOK_URL", "N8N_WEBHOOK_SECRET", "AGENT_SUPABASE_URL", "AGENT_SUPABASE_SERVICE_KEY"]) {
  if (process.env[v]) ok(`${v} renseignée`);
  else echec(`${v} manquante (fichier web/.env.local)`);
}
const url = process.env.N8N_WEBHOOK_URL;
const secret = process.env.N8N_WEBHOOK_SECRET;

console.log("\n2. Webhook n8n (faux secret : doit être refusé, aucune exécution)");
if (url) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-okto-key": "faux-secret-de-test" }, body: "{}", signal: AbortSignal.timeout(10_000) });
    if (r.status === 401 || r.status === 403) ok(`Joignable, faux secret refusé (HTTP ${r.status})`);
    else if (r.status === 404) echec("HTTP 404 : workflow désactivé ou URL incorrecte (utilisez l'URL de production, pas /webhook-test/)");
    else echec(`HTTP ${r.status} inattendu : l'authentification par en-tête est-elle active sur le nœud Webhook ?`);
  } catch (e) {
    echec(`Injoignable : ${e.message}`);
  }
}

console.log("\n3. Base Supabase de l'agent (lecture de la table demandes)");
if (process.env.AGENT_SUPABASE_URL && process.env.AGENT_SUPABASE_SERVICE_KEY) {
  try {
    const key = process.env.AGENT_SUPABASE_SERVICE_KEY;
    const r = await fetch(`${process.env.AGENT_SUPABASE_URL}/rest/v1/demandes?select=id,reference,created_at&order=created_at.desc&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await r.json().catch(() => null);
    if (r.ok) ok(`Lecture OK${body?.[0] ? ` (dernière demande : ${body[0].reference})` : " (table vide)"}`);
    else echec(`HTTP ${r.status} : ${body?.message ?? "clé ou URL incorrecte"}`);
  } catch (e) {
    echec(`Injoignable : ${e.message}`);
  }
}

const EXEMPLES = {
  prise_en_charge: { message: "Test de connexion : porte claquée, clés à l'intérieur, client devant la porte.", client: { nom: "Client Test", telephone: "06 39 98 00 01", adresse: "12 avenue Fictive, 93200 Saint-Denis" } },
  devis: { message: "Test de connexion : devis pour remplacer un cylindre de porte d'entrée, logement de plus de 2 ans, en semaine.", client: { nom: "Client Test", email: "client.test@example.com" } },
  rapport_facture: { message: "Test de connexion : intervention terminée, préparer le rapport et la facture.", client: { nom: "Client Test", adresse: "12 avenue Fictive, 93200 Saint-Denis" }, intervention: { date: new Date().toISOString().slice(0, 10), technicien: "Technicien Test", constat: "Cylindre forcé.", travaux: ["Remplacement du cylindre"], materiel: ["Cylindre européen 30/30"] } },
  communication: { message: "Test de connexion : rédiger un court message de suivi après intervention.", client: { nom: "Client Test", email: "client.test@example.com" } },
  planning: { message: "Test de connexion : proposer un rendez-vous non urgent pour changer une serrure.", client: { nom: "Client Test", telephone: "06 39 98 00 01", adresse: "12 avenue Fictive, 93200 Saint-Denis" } },
};

if (complet && url && secret) {
  const liste = tous ? TYPES : [TYPES.includes(typeArg) ? typeArg : "communication"];
  for (const type of liste) {
    console.log(`\n4. Appel réel « ${type} » (10 à 30 s)…`);
    const debut = Date.now();
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-okto-key": secret },
        body: JSON.stringify({ type_demande: type, artisan_id: process.env.AGENT_ARTISAN_ID || "ART-DEMO-001", ...EXEMPLES[type] }),
        signal: AbortSignal.timeout(60_000),
      });
      const s = Math.round((Date.now() - debut) / 1000);
      if (r.status === 401 || r.status === 403) {
        echec(`Secret refusé (HTTP ${r.status}) : vérifiez N8N_WEBHOOK_SECRET`);
        continue;
      }
      const body = await r.json().catch(() => null);
      if (!r.ok || !body) {
        echec(`HTTP ${r.status} après ${s} s : le workflow a échoué (voir les exécutions n8n)`);
        continue;
      }
      if (body.success && !body.resultat?.erreur) ok(`${body.reference} traité en ${s} s (type ${body.type_demande})`);
      else echec(`Réponse en ${s} s mais l'agent a renvoyé une erreur : ${body.resultat?.erreur ?? "inconnue"}`);
      console.log(`     actions : ${JSON.stringify(body.actions)}`);
      console.log(`     données fictives : ${body.donnees_fictives}`);
    } catch (e) {
      echec(e.name === "TimeoutError" ? "Pas de réponse en 60 s" : `Erreur : ${e.message}`);
    }
  }
}

console.log(echecs ? `\n\x1b[31m${echecs} vérification(s) en échec.\x1b[0m\n` : "\n\x1b[32mTout est OK.\x1b[0m\n");
process.exit(echecs ? 1 : 0);
