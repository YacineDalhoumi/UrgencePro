import Link from "next/link";

export default function Introuvable() {
  return (
    <div className="py-10 text-center">
      <p className="font-display text-xl font-bold">Demande introuvable</p>
      <p className="mt-1 text-sm text-muted">Elle n’existe pas ou ne fait pas partie de votre entreprise.</p>
      <Link href="/demandes" className="mt-3 inline-block font-semibold text-accent hover:underline">
        Retour aux demandes
      </Link>
    </div>
  );
}
