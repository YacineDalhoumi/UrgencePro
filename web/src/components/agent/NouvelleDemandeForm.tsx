"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Send, RotateCcw, ChevronDown, Sparkles } from "lucide-react";
import { Alert, Button, Card, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { ResultatAgent } from "./Resultat";
import { TYPE_LABEL, TYPES_DEMANDE, type ApiReponse, type TypeDemande } from "@/lib/agent/types";

type TypeChoix = "auto" | TypeDemande;

const EXEMPLES: { type: TypeChoix; label: string; message: string; client?: Partial<Record<"nom" | "telephone" | "email" | "adresse", string>> }[] = [
  { type: "auto", label: "Porte claquée (routage auto)", message: "Bonjour, ma porte a claqué et mes clés sont restées à l'intérieur avec mon bébé. Je suis devant chez moi, c'est urgent !", client: { nom: "Claire Martin", telephone: "06 39 98 12 34", adresse: "12 avenue Fictive, 93200 Saint-Denis" } },
  { type: "devis", label: "Devis cylindre", message: "Pouvez-vous me faire un devis pour remplacer le cylindre de ma porte d'entrée ? Logement de plus de 10 ans, en semaine.", client: { nom: "Paul Durand", email: "paul.durand@example.com" } },
  { type: "rapport_facture", label: "Rapport après intervention", message: "Intervention terminée chez Mme Martin, merci de préparer le rapport et la facture.", client: { nom: "Claire Martin", adresse: "12 avenue Fictive, 93200 Saint-Denis" } },
  { type: "communication", label: "Relance de devis", message: "Relancer M. Durand pour le devis envoyé il y a 5 jours, sans réponse.", client: { nom: "Paul Durand", email: "paul.durand@example.com" } },
  { type: "planning", label: "Prendre rendez-vous", message: "Le client souhaite un rendez-vous demain matin pour changer sa serrure (pas d'urgence).", client: { nom: "Paul Durand", telephone: "06 39 98 55 10", adresse: "8 rue Imaginaire, 93100 Montreuil" } },
];

const vide = { nom: "", telephone: "", email: "", adresse: "" };
const interventionVide = { date: "", technicien: "", constat: "", travaux: "", materiel: "" };
const lignes = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function NouvelleDemandeForm({ artisanId }: { artisanId: string }) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<TypeChoix>("auto");
  const [client, setClient] = useState(vide);
  const [intervention, setIntervention] = useState(interventionVide);
  const [ouvrirClient, setOuvrirClient] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [ecoule, setEcoule] = useState(0);
  const [reponse, setReponse] = useState<ApiReponse | null>(null);
  const resultatRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!enCours) return;
    const debut = Date.now();
    const t = setInterval(() => setEcoule(Math.floor((Date.now() - debut) / 1000)), 1000);
    return () => clearInterval(t);
  }, [enCours]);

  useEffect(() => {
    if (reponse) resultatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [reponse]);

  const erreursChamps = reponse && !reponse.ok && reponse.code === "validation" ? reponse.details ?? {} : {};

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (enCours) return;
    setEcoule(0);
    setEnCours(true);
    setReponse(null);
    try {
      const res = await fetch("/api/agent/demandes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          type_demande: type,
          client,
          intervention: type === "rapport_facture" ? { ...intervention, travaux: lignes(intervention.travaux), materiel: lignes(intervention.materiel) } : undefined,
        }),
        // Un peu plus que le délai serveur (60 s) pour recevoir son message d'erreur plutôt qu'une coupure
        signal: AbortSignal.timeout(75_000),
      });
      const json = (await res.json().catch(() => null)) as ApiReponse | null;
      setReponse(json ?? { ok: false, code: "reponse_illisible", message: `Réponse inattendue du serveur (HTTP ${res.status}).` });
      if (json && !json.ok && json.code === "non_connecte") router.push("/connexion?suivant=/agent/nouvelle");
    } catch (err) {
      const timeout = (err as Error)?.name === "TimeoutError";
      setReponse({ ok: false, code: timeout ? "timeout" : "reseau", message: timeout ? "Pas de réponse après 75 secondes. Vérifiez l’historique avant de relancer." : "Connexion au serveur impossible. Vérifiez votre réseau." });
    } finally {
      setEnCours(false);
    }
  }

  function reinitialiser() {
    setMessage("");
    setType("auto");
    setClient(vide);
    setIntervention(interventionVide);
    setReponse(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form onSubmit={envoyer} className="min-w-0 space-y-4" noValidate>
        <p className="text-xs text-muted">
          Entreprise : <span className="font-mono">{artisanId}</span>
        </p>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Sparkles className="size-4" /> Exemples
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EXEMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                disabled={enCours}
                onClick={() => {
                  setMessage(ex.message);
                  setType(ex.type);
                  setClient({ ...vide, ...ex.client });
                  setOuvrirClient(true);
                  if (ex.type === "rapport_facture")
                    setIntervention({ date: new Date().toISOString().slice(0, 10), technicien: "Karim", constat: "Cylindre forcé suite à une tentative d'effraction, la porte ne fermait plus à clé.", travaux: "Dépose du cylindre endommagé\nPose d'un cylindre neuf\nEssais de fonctionnement", materiel: "Cylindre européen 30/30" });
                }}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:border-accent hover:text-fg disabled:opacity-50"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Demande" htmlFor="message" error={erreursChamps.message} hint="Ce qu’a dit le client, ou ce que vous voulez faire.">
          <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} required disabled={enCours} placeholder="Ex. : Porte claquée au 3e étage, clés à l'intérieur…" />
        </Field>

        <Field label="Type de traitement" htmlFor="type_demande" hint={type === "auto" ? "Le routeur IA choisit le bon agent." : undefined}>
          <Select id="type_demande" value={type} onChange={(e) => setType(e.target.value as TypeChoix)} disabled={enCours}>
            <option value="auto">Automatique</option>
            {TYPES_DEMANDE.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Card>
          <button type="button" onClick={() => setOuvrirClient(!ouvrirClient)} className="flex w-full items-center justify-between px-4 py-3 text-left" aria-expanded={ouvrirClient}>
            <span className="font-semibold">Client <span className="font-normal text-muted">(facultatif)</span></span>
            <ChevronDown className={cn("size-4 transition-transform", ouvrirClient && "rotate-180")} />
          </button>
          {ouvrirClient && (
            <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2">
              <Field label="Nom" htmlFor="client_nom" error={erreursChamps["client.nom"]}>
                <Input id="client_nom" value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} disabled={enCours} autoComplete="off" />
              </Field>
              <Field label="Téléphone" htmlFor="client_tel" error={erreursChamps["client.telephone"]}>
                <Input id="client_tel" type="tel" inputMode="tel" value={client.telephone} onChange={(e) => setClient({ ...client, telephone: e.target.value })} disabled={enCours} autoComplete="off" />
              </Field>
              <Field label="Email" htmlFor="client_email" error={erreursChamps["client.email"]} className="sm:col-span-2">
                <Input id="client_email" type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} disabled={enCours} autoComplete="off" />
              </Field>
              <Field label="Adresse" htmlFor="client_adresse" error={erreursChamps["client.adresse"]} className="sm:col-span-2">
                <Input id="client_adresse" value={client.adresse} onChange={(e) => setClient({ ...client, adresse: e.target.value })} disabled={enCours} autoComplete="off" />
              </Field>
            </div>
          )}
        </Card>

        {type === "rapport_facture" && (
          <Card className="border-accent/40 p-4">
            <h2 className="mb-3 font-display font-bold">Intervention</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Date" htmlFor="iv_date">
                <Input id="iv_date" type="date" value={intervention.date} onChange={(e) => setIntervention({ ...intervention, date: e.target.value })} disabled={enCours} />
              </Field>
              <Field label="Technicien" htmlFor="iv_tech">
                <Input id="iv_tech" value={intervention.technicien} onChange={(e) => setIntervention({ ...intervention, technicien: e.target.value })} disabled={enCours} />
              </Field>
              <Field label="Constat" htmlFor="iv_constat" className="sm:col-span-2">
                <Textarea id="iv_constat" value={intervention.constat} onChange={(e) => setIntervention({ ...intervention, constat: e.target.value })} rows={3} disabled={enCours} />
              </Field>
              <Field label="Travaux réalisés" htmlFor="iv_travaux" hint="Un élément par ligne." className="sm:col-span-2">
                <Textarea id="iv_travaux" value={intervention.travaux} onChange={(e) => setIntervention({ ...intervention, travaux: e.target.value })} rows={3} disabled={enCours} />
              </Field>
              <Field label="Matériel posé" htmlFor="iv_materiel" hint="Un élément par ligne." className="sm:col-span-2">
                <Textarea id="iv_materiel" value={intervention.materiel} onChange={(e) => setIntervention({ ...intervention, materiel: e.target.value })} rows={2} disabled={enCours} />
              </Field>
            </div>
          </Card>
        )}

        <div className="sticky bottom-0 -mx-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="submit" variant="primary" className="h-12 w-full text-base" disabled={enCours || message.trim().length < 5}>
            <Send /> {enCours ? "Envoi en cours…" : "Envoyer à l’agent"}
          </Button>
        </div>
      </form>

      <section ref={resultatRef} className="min-w-0 scroll-mt-20" aria-live="polite">
        {enCours && (
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Bot className="size-5" />
              </span>
              <div>
                <p className="font-display text-lg font-bold">L’agent traite la demande…</p>
                <p className="text-sm text-muted tnum">
                  {ecoule} s · en général 10 à 30 secondes. Ne fermez pas la page.
                </p>
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div className="progress-indeterminate h-full w-2/5 rounded-full bg-accent" />
            </div>
            {ecoule >= 40 && <p className="mt-3 text-sm text-warn">C’est plus long que d’habitude. L’attente maximale est de 60 secondes.</p>}
          </Card>
        )}

        {!enCours && reponse && !reponse.ok && reponse.code !== "validation" && (
          <Alert tone="bad" title={TITRE_ERREUR[reponse.code] ?? "Erreur"}>
            {reponse.message}
          </Alert>
        )}
        {!enCours && reponse && !reponse.ok && reponse.code === "validation" && <Alert tone="warn" title="Formulaire incomplet">{reponse.message}</Alert>}

        {!enCours && reponse?.ok && (
          <div className="space-y-4">
            {reponse.simule && <Alert tone="info">Mode simulé : aucune requête n’a été envoyée à n8n.</Alert>}
            <ResultatAgent
              success={reponse.data.success}
              reference={reponse.data.reference}
              typeDemande={reponse.data.type_demande}
              resultat={reponse.data.resultat}
              actions={reponse.data.actions}
              donneesFictives={reponse.data.donnees_fictives}
              dureeMs={reponse.dureeMs}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={reinitialiser}>
                <RotateCcw /> Nouvelle demande
              </Button>
              {reponse.data.id && !reponse.simule && (
                <Link href={`/agent/historique/${reponse.data.id}`} className="inline-flex h-11 items-center rounded-md px-4 text-sm font-semibold text-accent hover:underline">
                  Voir dans l’historique
                </Link>
              )}
            </div>
          </div>
        )}

        {!enCours && !reponse && (
          <div className="hidden h-full min-h-60 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted lg:flex">
            <Bot className="mb-2 size-8" />
            Le résultat de l’agent s’affichera ici : urgence, devis, rapport, message ou créneau, et ce qui a été fait (PDF, email, agenda).
          </div>
        )}
      </section>
    </div>
  );
}

const TITRE_ERREUR: Record<string, string> = {
  timeout: "Délai dépassé",
  secret_refuse: "Accès refusé par n8n",
  webhook_introuvable: "Workflow introuvable",
  erreur_workflow: "Erreur dans le workflow",
  reponse_illisible: "Réponse illisible",
  reseau: "Problème de connexion",
  limite: "Trop de demandes",
  config: "Configuration incomplète",
  non_connecte: "Session expirée",
  compte_non_active: "Compte non activé",
};
