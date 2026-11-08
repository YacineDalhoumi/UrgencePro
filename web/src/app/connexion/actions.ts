"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAuthClient } from "@/lib/supabase/server";

export interface EtatConnexion {
  erreur?: string;
  info?: string;
}

/** N'accepte que des chemins internes (évite les redirections ouvertes). */
const cheminSur = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/agent/nouvelle";
};

export async function seConnecter(_prev: EtatConnexion, form: FormData): Promise<EtatConnexion> {
  const email = String(form.get("email") ?? "").trim();
  const motDePasse = String(form.get("mot_de_passe") ?? "");
  if (!email || !motDePasse) return { erreur: "Renseignez votre email et votre mot de passe." };
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error) {
    return { erreur: error.message.includes("Invalid login") ? "Email ou mot de passe incorrect." : `Connexion impossible : ${error.message}` };
  }
  redirect(cheminSur(form.get("suivant")));
}

export async function motDePasseOublie(_prev: EtatConnexion, form: FormData): Promise<EtatConnexion> {
  const email = String(form.get("email") ?? "").trim();
  if (!email) return { erreur: "Renseignez votre email pour recevoir le lien." };
  const h = await headers();
  const origine = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await createAuthClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origine}/auth/confirm?suivant=/compte/mot-de-passe` });
  // Même message que le compte existe ou non (ne révèle pas les adresses inscrites).
  return { info: "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé." };
}

/** Point d'entrée unique du formulaire : connexion ou demande de lien selon le champ « mode ». */
export async function actionConnexion(prev: EtatConnexion, form: FormData): Promise<EtatConnexion> {
  return form.get("mode") === "oubli" ? motDePasseOublie(prev, form) : seConnecter(prev, form);
}

export async function seDeconnecter() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
