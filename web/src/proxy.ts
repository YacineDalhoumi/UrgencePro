import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy-session";
import { publiquesManquantes } from "@/lib/config-check";

/**
 * Proxy (ex-middleware) : rafraîchit la session et protège l'espace de travail.
 * Les routes /api/* vérifient elles-mêmes la session et répondent 401 en JSON.
 */
/** Pages réservées aux comptes connectés (la page publique /devis/… reste accessible sans compte). */
const ESPACE = ["/tableau-de-bord", "/demandes", "/agenda", "/techniciens", "/parametres"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Configuration incomplète : page d'explication plutôt qu'une erreur 500 sur tout le site
  if (publiquesManquantes().length) {
    if (pathname === "/configuration") return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, code: "config", message: "Configuration Supabase manquante sur le serveur." }, { status: 500 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/configuration";
    url.search = "";
    return NextResponse.rewrite(url);
  }

  let session: Awaited<ReturnType<typeof refreshSession>>;
  try {
    session = await refreshSession(request);
  } catch (e) {
    // Supabase injoignable ou clé invalide : on laisse passer sans session (les pages redirigent vers la connexion)
    console.error("[proxy] rafraîchissement de session impossible :", (e as Error).message);
    session = { response: NextResponse.next({ request }), userId: null };
  }
  const { response, userId } = session;
  if (!userId && ESPACE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?suivant=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
