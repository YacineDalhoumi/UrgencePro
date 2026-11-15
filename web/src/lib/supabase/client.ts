"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Client navigateur lié à la session (cookies) : utilisé pour le temps réel, soumis aux règles RLS. */
export const createNavigateurClient = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
