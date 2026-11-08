import Link from "next/link";

export default function Introuvable() {
  return (
    <div className="py-10 text-center">
      <p className="font-display text-xl font-bold">Demande introuvable</p>
      <p className="mt-1 text-sm text-muted">Elle n’existe pas ou appartient à un autre artisan.</p>
      <Link href="/agent/historique" className="mt-3 inline-block font-semibold text-accent hover:underline">
        Retour à l’historique
      </Link>
    </div>
  );
}
