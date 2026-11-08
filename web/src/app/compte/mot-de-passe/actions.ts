"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";

export async function changerMotDePasse(_prev: { erreur?: string }, form: FormData): Promise<{ erreur?: string }> {
  const mdp = String(form.get("mot_de_passe") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");
  if (mdp.length < 10) return { erreur: "10 caractères minimum." };
  if (mdp !== confirmation) return { erreur: "Les deux mots de passe ne correspondent pas." };
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.updateUser({ password: mdp });
  if (error) return { erreur: `Modification impossible : ${error.message}` };
  redirect("/agent/nouvelle");
}
