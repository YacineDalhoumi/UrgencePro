import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/server";

/**
 * Lien reçu par email (invitation, réinitialisation du mot de passe) :
 * valide le jeton puis redirige, par défaut vers la page de choix du mot de passe.
 * Deux formats acceptés :
 *  - modèles d'email Supabase par défaut : …/auth/confirm?code=… (échange PKCE) ;
 *  - modèles personnalisés : {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const suivantBrut = searchParams.get("suivant") ?? "/compte/mot-de-passe";
  const suivant = suivantBrut.startsWith("/") && !suivantBrut.startsWith("//") ? suivantBrut : "/compte/mot-de-passe";

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(suivant, request.url));
  }

  if (tokenHash && type) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(suivant, request.url));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", request.url));
}
