"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Eraser, PenLine } from "lucide-react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { eur } from "@/lib/format";

const MESSAGES: Record<string, string> = {
  introuvable: "Ce lien n’est plus valable.",
  deja_signe: "Ce devis a déjà été signé.",
  expire: "Ce devis a expiré : contactez l’entreprise pour en obtenir un nouveau.",
  refuse: "Ce devis a été refusé.",
  nom_requis: "Indiquez votre nom complet.",
  signature_invalide: "La signature n’a pas pu être lue. Effacez et signez à nouveau.",
};

/**
 * Signature du devis au doigt ou à la souris. L'appel part directement du navigateur vers la base :
 * c'est elle qui relève l'adresse IP et le navigateur du signataire, et calcule l'empreinte du devis.
 */
export function Signature({ token, totalTtc }: { token: string; totalTtc: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dessin = useRef(false);
  const [aSigne, setASigne] = useState(false);
  const [accepte, setAccepte] = useState(false);
  const [nom, setNom] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [refus, setRefus] = useState<"ferme" | "ouvert">("ferme");
  const [motif, setMotif] = useState("");
  const router = useRouter();

  useEffect(() => {
    const c = canvasRef.current!;
    const ajuster = () => {
      const r = c.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * ratio);
      c.height = Math.round(r.height * ratio);
      const ctx = c.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
      setASigne(false);
    };
    ajuster();
    window.addEventListener("resize", ajuster);
    return () => window.removeEventListener("resize", ajuster);
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const effacer = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setASigne(false);
  };

  /** Image PNG de la signature, sur fond blanc (lisible en mode sombre comme en impression). */
  const image = () => {
    const c = canvasRef.current!;
    const copie = document.createElement("canvas");
    copie.width = c.width;
    copie.height = c.height;
    const ctx = copie.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, copie.width, copie.height);
    ctx.drawImage(c, 0, 0);
    return copie.toDataURL("image/png");
  };

  const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });

  async function signer(e: React.FormEvent) {
    e.preventDefault();
    if (!accepte || !aSigne || nom.trim().length < 2 || enCours) return;
    setEnCours(true);
    setErreur(null);
    const { data, error } = await db().rpc("signer_devis", { p_token: token, p_nom: nom.trim(), p_signature: image() });
    const r = data as { ok: boolean; raison?: string } | null;
    if (error || !r?.ok) {
      setErreur(error ? "La signature n’a pas pu être enregistrée. Vérifiez votre connexion et réessayez." : (MESSAGES[r?.raison ?? ""] ?? "Signature impossible."));
      setEnCours(false);
      return;
    }
    // Planification de l'intervention : en arrière-plan, le client n'attend pas
    fetch("/api/devis/planifier", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton: token }), keepalive: true }).catch(() => {});
    router.refresh();
  }

  async function refuser() {
    setEnCours(true);
    setErreur(null);
    const { data, error } = await db().rpc("refuser_devis", { p_token: token, p_motif: motif });
    const r = data as { ok: boolean; raison?: string } | null;
    if (error || !r?.ok) {
      setErreur(error ? "Le refus n’a pas pu être enregistré. Réessayez." : (MESSAGES[r?.raison ?? ""] ?? "Action impossible."));
      setEnCours(false);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="p-4">
      <form onSubmit={signer} className="space-y-4">
        <h2 className="font-display text-lg font-bold">Accepter le devis</h2>
        {erreur && <Alert tone="bad">{erreur}</Alert>}

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
          <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
          <span className="text-sm">
            <b>J’accepte le devis</b> pour un montant de <b className="tnum">{eur(totalTtc)} TTC</b> et je donne mon accord pour la réalisation des travaux.
          </span>
        </label>

        <Field label="Votre nom complet" htmlFor="sig_nom">
          <Input id="sig_nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" maxLength={120} required />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-semibold">Votre signature</span>
            <button type="button" onClick={effacer} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
              <Eraser className="size-4" /> Effacer
            </button>
          </div>
          <canvas
            ref={canvasRef}
            aria-label="Zone de signature : signez avec le doigt ou la souris"
            className="h-44 w-full touch-none rounded-md border-2 border-dashed border-border bg-white"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dessin.current = true;
              const ctx = e.currentTarget.getContext("2d")!;
              const p = point(e);
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x + 0.1, p.y + 0.1);
              ctx.stroke();
              setASigne(true);
            }}
            onPointerMove={(e) => {
              if (!dessin.current) return;
              const ctx = e.currentTarget.getContext("2d")!;
              const p = point(e);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
            }}
            onPointerUp={() => (dessin.current = false)}
            onPointerCancel={() => (dessin.current = false)}
          />
          {!aSigne && <p className="mt-1 text-xs text-muted">Signez dans le cadre avec le doigt ou la souris.</p>}
        </div>

        <Button type="submit" variant="primary" className="h-12 w-full text-base" disabled={!accepte || !aSigne || nom.trim().length < 2 || enCours}>
          <PenLine /> {enCours ? "Enregistrement de la signature…" : "Signer"}
        </Button>
      </form>

      <div className="mt-5 border-t border-border pt-4">
        {refus === "ferme" ? (
          <button type="button" onClick={() => setRefus("ouvert")} className="text-sm font-semibold text-muted underline-offset-2 hover:underline" disabled={enCours}>
            Je ne souhaite pas donner suite
          </button>
        ) : (
          <div className="space-y-2">
            <Field label="Motif du refus (facultatif)" htmlFor="motif">
              <Textarea id="motif" value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} maxLength={1000} />
            </Field>
            <div className="flex gap-2">
              <Button variant="danger" onClick={refuser} disabled={enCours}>
                Refuser le devis
              </Button>
              <Button variant="ghost" onClick={() => setRefus("ferme")}>
                Revenir
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
