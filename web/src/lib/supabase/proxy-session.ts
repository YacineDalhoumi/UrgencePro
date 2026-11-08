import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Rafraîchit la session Supabase à chaque navigation et renvoie l'éventuel utilisateur. */
export async function refreshSession(request: NextRequest) {
  // Développement local sans projet d'authentification (voir AUTH_DEV_BYPASS) — jamais en production
  if (process.env.NODE_ENV === "development" && process.env.AUTH_DEV_BYPASS === "1") return { response: NextResponse.next({ request }), userId: "dev-local" };
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  return { response, userId: (data?.claims?.sub as string | undefined) ?? null };
}
