/**
 * Server-seitige ENV-Helfer. Werte werden zur Laufzeit gelesen, damit Tests
 * und Deployments nicht zwingend einen Build brauchen, wenn etwas anders ist.
 */

import { headers } from "next/headers";

/**
 * Ist auf dieser Instanz ein SMTP-Relay für den App-Mailversand (Fachstellen-
 * Mails) hinterlegt? Minimal nötig sind Host + Absenderadresse. Nicht gesetzt
 * → kein Versand; die aufrufende Action meldet einen Konfigurationsfehler.
 * Betrifft NICHT die Auth-Mails (GoTrue/Supabase, eigene Strecke).
 */
export function istSmtpKonfiguriert(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.MAIL_FROM?.trim());
}

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * Liefert die Origin (Schema + Host + ggf. Port), unter der der Browser
 * die App gerade aufruft. Funktioniert für localhost, Tailscale-IPs und
 * Produktion gleichermaßen.
 *
 * Reihenfolge:
 *   1. NEXT_PUBLIC_SITE_URL, falls EXPLIZIT gesetzt — Origin/x-forwarded-host
 *      sind Request-Header und damit prinzipiell client-kontrollierbar; eine
 *      konfigurierte Site-URL schlägt sie (Härtung: der Wert fließt u. a. in
 *      den Magic-Link-Redirect). Auf Produktiv-Instanzen setzen!
 *   2. Origin-Header (vom Browser bei POST/Server-Action gesetzt)
 *   3. x-forwarded-host + x-forwarded-proto (Reverse-Proxy)
 *   4. host + Protokoll-Heuristik
 */
export async function getRequestOrigin(): Promise<string> {
  const konfiguriert = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (konfiguriert) return konfiguriert.replace(/\/$/, "");

  const h = await headers();

  const origin = h.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const forwardedHost = h.get("x-forwarded-host");
  const forwardedProto = h.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto ?? "https";
    return `${proto}://${forwardedHost}`.replace(/\/$/, "");
  }

  const host = h.get("host");
  if (host) {
    const proto = host.startsWith("localhost") || host.match(/^\d+\.\d+\.\d+\.\d+/)
      ? "http"
      : "https";
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  return getSiteUrl();
}
