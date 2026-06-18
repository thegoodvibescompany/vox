import nodemailer from "nodemailer";
import { istSmtpKonfiguriert } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Zentraler App-Mailversand für Fachstellen-Mails.
 * Provider-agnostischer SMTP-Relay über ENV — funktioniert mit jedem Relay
 * (eigener Postfix, Smarthost, Resend-SMTP …), ohne Code zu ändern.
 *
 * WICHTIG: Das ist NICHT die Auth-Mail-Strecke. Magic-Link-/Bestätigungsmails
 * versendet GoTrue selbst (eigene SMTP-Konfiguration am Supabase-Stack).
 *
 * SMTP ist für den Fachstellen-Versand Pflicht: Ist es nicht konfiguriert,
 * wird nichts versendet (skipped) und die aufrufende Action meldet einen
 * Konfigurationsfehler an die Nutzer:in.
 */

export type MailErgebnis =
  | { ok: true }
  | { ok: false; skipped: true } // SMTP nicht konfiguriert
  | { ok: false; skipped: false; error: string };

type MailEingabe = {
  to: string | string[];
  subject: string;
  /** Plaintext-Variante — dient als Fallback für Clients ohne HTML. */
  text: string;
  /** Optionale HTML-Variante. Wird als multipart/alternative neben `text`
   *  versendet; Clients wählen selbst die darstellbare Variante. */
  html?: string;
  /** Damit die Fachstelle direkt der absendenden Person antworten kann. */
  replyTo?: string;
  /** Anzeigename des Absenders, z. B. „Bürgertelefon {Behörde}". */
  fromName?: string;
};

function baueTransport(): nodemailer.Transporter {
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER?.trim() || undefined;
  const pass = process.env.SMTP_PASS?.trim() || undefined;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port,
    // secure=true nur für implizites TLS (Port 465); 587 nutzt STARTTLS.
    secure: process.env.SMTP_SECURE === "true",
    auth: user ? { user, pass } : undefined,
  });
}

export async function sendeMail(eingabe: MailEingabe): Promise<MailErgebnis> {
  if (!istSmtpKonfiguriert()) {
    logger.debug("SMTP nicht konfiguriert — Mailversand übersprungen.");
    return { ok: false, skipped: true };
  }

  const address = process.env.MAIL_FROM!.trim();
  try {
    await baueTransport().sendMail({
      from: eingabe.fromName ? { name: eingabe.fromName, address } : address,
      to: eingabe.to,
      replyTo: eingabe.replyTo,
      subject: eingabe.subject,
      text: eingabe.text,
      html: eingabe.html,
    });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.error("Mailversand fehlgeschlagen", error);
    return { ok: false, skipped: false, error };
  }
}
