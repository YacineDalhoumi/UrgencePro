import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase/server";
import { defaultArtisanId, devAuthBypass } from "./env";

export interface CurrentUser {
  id: string;
  email: string | null;
  /** Artisan rattaché au compte (app_metadata.artisan_id, posé par l'administrateur), sinon null. */
  artisanId: string | null;
}

export type ArtisanUser = CurrentUser & { artisanId: string };

/**
 * Utilisateur connecté, vérifié côté serveur (signature du jeton contrôlée par getClaims).
 * L'artisan_id vient de app_metadata, que l'utilisateur ne peut pas modifier lui-même.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (devAuthBypass()) return { id: "dev-local", email: "dev@localhost", artisanId: defaultArtisanId() };
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as { sub: string; email?: string; app_metadata?: { artisan_id?: string } };
  return { id: claims.sub, email: claims.email ?? null, artisanId: claims.app_metadata?.artisan_id?.trim() || null };
}

/** Pour les pages : redirige vers la connexion si personne n'est connecté. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion${next ? `?suivant=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/**
 * Pour l'espace agent : il faut un compte rattaché à un artisan.
 * Un compte créé par inscription libre (sans artisan_id) n'a accès à rien.
 */
export async function requireArtisan(next?: string): Promise<ArtisanUser> {
  const user = await requireUser(next);
  if (!user.artisanId) redirect("/compte/non-active");
  return user as ArtisanUser;
}
