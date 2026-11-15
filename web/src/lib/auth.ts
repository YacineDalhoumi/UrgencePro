import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase/server";
import { defaultArtisanId, devAuthBypass } from "./env";

export type Role = "gerant" | "technicien";

export interface CurrentUser {
  id: string;
  email: string | null;
  /** Entreprise du compte (table « membres »), sinon null. */
  artisanId: string | null;
  role: Role | null;
  /** Fiche technicien liée au compte (rôle « technicien » uniquement). */
  technicienId: string | null;
}

export type ArtisanUser = CurrentUser & { artisanId: string; role: Role };

/**
 * Utilisateur connecté, vérifié côté serveur (signature du jeton contrôlée par getClaims).
 * L'entreprise et le rôle viennent de la table « membres », lue avec la session de l'utilisateur
 * (la règle RLS ne lui laisse lire que sa propre ligne) : il ne peut pas les modifier lui-même.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (devAuthBypass()) return { id: "dev-local", email: "dev@localhost", artisanId: defaultArtisanId(), role: "gerant", technicienId: null };
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as { sub: string; email?: string };
  const { data: membre } = await supabase
    .from("membres")
    .select("artisan_id, role, technicien_id")
    .eq("user_id", claims.sub)
    .maybeSingle<{ artisan_id: string; role: Role; technicien_id: string | null }>();
  return {
    id: claims.sub,
    email: claims.email ?? null,
    artisanId: membre?.artisan_id ?? null,
    role: membre?.role ?? null,
    technicienId: membre?.technicien_id ?? null,
  };
}

/** Pour les pages : redirige vers la connexion si personne n'est connecté. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion${next ? `?suivant=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/**
 * Pour l'espace de travail : il faut un compte rattaché à une entreprise.
 * Un compte créé par inscription libre (sans ligne dans « membres ») n'a accès à rien.
 */
export async function requireArtisan(next?: string): Promise<ArtisanUser> {
  const user = await requireUser(next);
  if (!user.artisanId || !user.role) redirect("/compte/non-active");
  return user as ArtisanUser;
}

/** Pages réservées au gérant : un technicien est renvoyé vers son agenda. */
export async function requireGerant(next?: string): Promise<ArtisanUser> {
  const user = await requireArtisan(next);
  if (user.role !== "gerant") redirect("/agenda");
  return user;
}
