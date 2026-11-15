import "server-only";
import { NextResponse } from "next/server";
import { HTTP_STATUS } from "./agent/n8n";
import type { ApiReponse, CodeErreur } from "./agent/types";
import type { Issue } from "./cycle";

export const erreurApi = (code: CodeErreur, message: string, extra?: { details?: Record<string, string>; headers?: HeadersInit; demandeId?: string }) =>
  NextResponse.json<ApiReponse>({ ok: false, code, message, details: extra?.details, demandeId: extra?.demandeId }, { status: HTTP_STATUS[code], headers: extra?.headers });

export const reponseIssue = (i: Issue) =>
  i.ok ? NextResponse.json<ApiReponse>({ ok: true, demandeId: i.demandeId, avertissement: i.avertissement }) : erreurApi(i.code, i.message, { demandeId: i.demandeId });

/** Adresse publique de l'application (liens envoyés aux clients). APP_URL l'impose si elle est définie. */
export function origine(request: Request): string {
  const fixe = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (fixe) return fixe;
  const h = request.headers;
  const hote = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return hote ? `${proto}://${hote}` : new URL(request.url).origin;
}

export async function lireJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
