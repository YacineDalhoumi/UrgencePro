import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { FormulaireMotDePasse } from "./formulaire";

export const metadata: Metadata = { title: "Choisir un mot de passe" };

export default async function PageMotDePasse() {
  const user = await requireUser("/compte/mot-de-passe");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-extrabold">Choisir un mot de passe</h1>
        <p className="mt-1 text-sm text-muted">Compte : {user.email}</p>
        <FormulaireMotDePasse />
      </div>
    </main>
  );
}
