import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Empreinte SHA-256 (hexadécimal) — identique à app.empreinte() en base. */
export const sha256Hex = (texte: string) => createHash("sha256").update(texte, "utf8").digest("hex");

/**
 * Jeton de signature : 32 octets aléatoires (256 bits) en base64url.
 * Seule son empreinte est enregistrée ; le jeton n'existe que dans le lien envoyé au client.
 */
export function nouveauJeton(): { jeton: string; empreinte: string } {
  const jeton = randomBytes(32).toString("base64url");
  return { jeton, empreinte: sha256Hex(jeton) };
}

/** Un jeton bien formé (évite d'interroger la base pour n'importe quelle URL). */
export const jetonValide = (j: string) => /^[A-Za-z0-9_-]{43}$/.test(j);
