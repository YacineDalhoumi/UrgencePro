import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase « authentification » (projet de l'application), lié aux cookies de la requête.
 * Utilise la clé publiable : il n'a que les droits de l'utilisateur connecté.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Appelé depuis un Server Component : le proxy se charge de rafraîchir la session.
        }
      },
    },
  });
}

/**
 * Client sans session (rôle « anon ») pour les traitements serveur déclenchés par la page publique
 * de signature. Il n'a accès qu'aux fonctions protégées par le jeton du devis (et la clé serveur).
 */
export function createAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
