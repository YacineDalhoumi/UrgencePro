import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase/server";
import { defaultArtisanId, devAuthBypass } from "./env";

export interface CurrentUser {
  id: string;
  email: string | null;
  /** Artisan rattaché au compte (app_metadata.artisan_id), sinon l'artisan de démonstration. */
  artisanId: string;
  artisanIsDefault: boolean;
}

/**
 * Utilisateur connecté, vérifié côté serveur (signature du jeton contrôlée par getClaims).
 * L'artisan_id vient de app_metadata, que l'utilisateur ne peut pas modifier lui-même.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (devAuthBypass()) return { id: "dev-local", email: "dev@localhost", artisanId: defaultArtisanId(), artisanIsDefault: true };
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as { sub: string; email?: string; app_metadata?: { artisan_id?: string } };
  const fromAccount = claims.app_metadata?.artisan_id?.trim();
  return {
    id: claims.sub,
    email: claims.email ?? null,
    artisanId: fromAccount || defaultArtisanId(),
    artisanIsDefault: !fromAccount,
  };
}

/** Pour les pages : redirige vers la connexion si personne n'est connecté. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion${next ? `?suivant=${encodeURIComponent(next)}` : ""}`);
  return user;
}
