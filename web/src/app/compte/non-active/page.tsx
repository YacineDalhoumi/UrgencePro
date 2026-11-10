import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { seDeconnecter } from "@/app/connexion/actions";
import { Button } from "@/components/ui";

export const metadata: Metadata = { title: "Compte non activé" };

export default async function PageNonActive() {
  const user = await requireUser("/compte/non-active");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-extrabold">Compte non activé</h1>
        <p className="mt-2 text-sm text-muted">
          Le compte <b>{user.email}</b> n’est rattaché à aucune entreprise. Demandez à l’administrateur de l’activer.
        </p>
        <form action={seDeconnecter} className="mt-6">
          <Button type="submit" className="w-full">
            Se déconnecter
          </Button>
        </form>
      </div>
    </main>
  );
}
