"use server";

import { revalidatePath } from "next/cache";
import { requireRecht } from "@/lib/auth";
import { getAktiveLage } from "@/lib/lage";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendeMail } from "@/lib/mail";
import { baueMailLayout } from "@/lib/mail-layout";

export type DashboardActionState = {
  ok: boolean;
  message: string;
};

// Akzeptiert Komma-, Semikolon- und Newline-getrennte Eingabe.
// Dedupliziert auf Basis der lowercase-Form.
function parseEmpfaengerEmails(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[\n,;]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

const GUELTIGKEIT_HINWEIS =
  "Der Link ist 7 Tage gültig. Hinweis: Haben mehrere Personen denselben Auftrag erhalten, wird nur die zuerst eingegangene Antwort übernommen.";

/**
 * Eine Quelle der Wahrheit für Betreff, Plaintext und HTML der Fachstellen-Mail.
 * Plaintext und HTML werden inhaltsgleich gehalten und als multipart versendet;
 * der Plaintext dient als Fallback für Clients ohne HTML. Die Absenderzeile
 * kommt aus `behoerdeName` (mandantenfähig).
 */
function baueFachstellenMail(
  link: string,
  frageText: string,
  variante: "neu" | "rueckfrage",
  behoerdeName: string,
): { subject: string; text: string; html: string } {
  const istRueckfrage = variante === "rueckfrage";
  const subject = istRueckfrage
    ? "Bürgerfrage: Rückfrage zu Ihrer Antwort"
    : "Bürgerfrage: Bitte um Beantwortung";
  const intro = istRueckfrage
    ? "vielen Dank für Ihre bisherige Antwort. Dazu ist eine Rückfrage entstanden. Den bisherigen Schriftwechsel und die Rückfrage finden Sie über den folgenden Link."
    : "über das Bürgertelefon ist eine Bürgerfrage eingegangen, die in Ihren Zuständigkeitsbereich fällt. Wir bitten Sie um eine fachliche Beantwortung über den folgenden Link.";
  const frageLabel = istRueckfrage ? "Rückfrage" : "Frage";
  const buttonLabel = istRueckfrage ? "Rückfrage ansehen" : "Frage beantworten";
  const preheader = istRueckfrage
    ? "Zu Ihrer Antwort ist eine Rückfrage entstanden."
    : "Eine Bürgerfrage wartet auf Ihre fachliche Beantwortung.";
  const signatur = `Bürgertelefon ${behoerdeName}`.trim();

  const text = `Sehr geehrte Damen und Herren,

${intro}

${frageLabel}:
${frageText}

${buttonLabel}:
${link}

${GUELTIGKEIT_HINWEIS}

Mit freundlichen Grüßen
${signatur}

---
Diese E-Mail wurde automatisch über das Bürgertelefon-System VOX versendet. Bitte antworten Sie über den enthaltenen Link, nicht auf diese Nachricht.`;

  const html = baueMailLayout({
    preheader,
    heading: istRueckfrage ? "Rückfrage zu Ihrer Antwort" : "Bürgerfrage zur Beantwortung",
    introHtml: `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#44403c;margin:0;">Sehr geehrte Damen und Herren,<br /><br />${intro}</p>`,
    quote: { label: frageLabel, text: frageText },
    button: { label: buttonLabel, url: link },
    linkFallbackUrl: link,
    noteHtml: GUELTIGKEIT_HINWEIS,
    signature: `Mit freundlichen Grüßen\n${signatur}`,
  });

  return { subject, text, html };
}

/** Einheitlicher Fehlertext, wenn der SMTP-Versand nicht klappt. */
function versandFehlerText(mail: { skipped?: boolean; error?: string }): string {
  return mail.skipped
    ? "E-Mail-Versand ist auf diesem System nicht eingerichtet. Bitte an die Administration wenden."
    : `E-Mail konnte nicht versendet werden: ${mail.error ?? "unbekannter Fehler"}`;
}

/**
 * Name der eigenen Behörde für die Absenderzeile. RLS auf `behoerde` liefert
 * dem Aufrufer nur die eigene Behörde; gefiltert wird zusätzlich über die
 * behoerde_id des Profils (robust auch für Plattform-Admins, die mehrere
 * sehen dürfen). Fallback „Bürgertelefon" bleibt sprachlich tragfähig.
 */
async function ladeBehoerdeName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  behoerdeId: string | null,
): Promise<string> {
  if (!behoerdeId) return "";
  const { data } = await supabase
    .from("behoerde")
    .select("name")
    .eq("id", behoerdeId)
    .maybeSingle();
  return data?.name?.trim() ?? "";
}

export async function erfasseBuergerfrage(
  _prev: DashboardActionState | undefined,
  formData: FormData,
): Promise<DashboardActionState> {
  const profile = await requireRecht("anfrage.erfassen");
  const lage = await getAktiveLage();
  if (!lage) {
    return { ok: false, message: "Keine aktive Lage. Frage kann nicht erfasst werden." };
  }

  const frage = (formData.get("frage_text") as string | null)?.trim();
  const kategorie_id = (formData.get("kategorie_id") as string | null) || null;
  const fachstelle_email = ((formData.get("fachstelle_email") as string | null) || "").trim() || null;
  // Optional: Rückfrage zu bestehendem FAQ. Beim Freigeben wird dieses FAQ
  // dann aktualisiert statt ein neues angelegt.
  const bezug_faq_id = ((formData.get("bezug_faq_id") as string | null) || "").trim() || null;

  if (!frage || frage.length < 5) {
    return { ok: false, message: "Bitte gib die Bürgerfrage etwas ausführlicher ein." };
  }
  if (fachstelle_email && !fachstelle_email.includes("@")) {
    return { ok: false, message: "Fachstellen-E-Mail ist ungültig." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("buergerfrage").insert({
    lage_id: lage.id,
    frage_text: frage,
    kategorie_id,
    fachstelle_email,
    erfasst_von: profile.id,
    bezug_faq_id,
  });
  if (error) {
    return { ok: false, message: `Speichern fehlgeschlagen: ${error.message}` };
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: bezug_faq_id
      ? "Rückfrage zum FAQ erfasst."
      : "Bürgerfrage erfasst.",
  };
}

function revalidiereFAQSeiten() {
  revalidatePath("/dashboard");
  revalidatePath("/alle-faqs");
  revalidatePath("/");
  revalidatePath("/themen", "page");
}

async function freigebenUndAlsFaqUebernehmen(
  bfId: string,
  finaleAntwort: string,
  redaktionWennGeaendert: string | null,
  autorId: string,
): Promise<DashboardActionState> {
  const supabase = await createClient();

  const { data: bf, error: ladeErr } = await supabase
    .from("buergerfrage")
    .select("id, lage_id, kategorie_id, frage_text, ins_faq_id, bezug_faq_id")
    .eq("id", bfId)
    .maybeSingle();
  if (ladeErr || !bf) {
    return { ok: false, message: "Bürgerfrage nicht gefunden." };
  }
  if (bf.ins_faq_id) {
    return { ok: false, message: "Anfrage ist bereits freigegeben." };
  }

  // Rückfrage zu bestehendem FAQ: dieses aktualisieren statt neu anlegen.
  let faqId: string;
  let istAktualisierung = false;
  if (bf.bezug_faq_id) {
    const { error: updFaqErr } = await supabase
      .from("faq")
      .update({
        antwort: finaleAntwort,
        stand_at: new Date().toISOString(),
      })
      .eq("id", bf.bezug_faq_id);
    if (updFaqErr) {
      return {
        ok: false,
        message: `FAQ-Aktualisierung fehlgeschlagen: ${updFaqErr.message}`,
      };
    }
    faqId = bf.bezug_faq_id;
    istAktualisierung = true;
  } else {
    const { data: faq, error: faqErr } = await supabase
      .from("faq")
      .insert({
        lage_id: bf.lage_id,
        kategorie_id: bf.kategorie_id,
        frage: bf.frage_text,
        antwort: finaleAntwort,
        autor_id: autorId,
        sichtbar: true,
      })
      .select("id")
      .single();
    if (faqErr || !faq) {
      return { ok: false, message: `FAQ-Anlage fehlgeschlagen: ${faqErr?.message ?? "unbekannt"}` };
    }
    faqId = faq.id;
  }

  const update: Record<string, unknown> = {
    status: "freigegeben",
    freigegeben_von: autorId,
    freigegeben_at: new Date().toISOString(),
    ins_faq_id: faqId,
  };
  if (redaktionWennGeaendert !== null) {
    update.antwort_redaktion = redaktionWennGeaendert;
  }

  const { error: updErr } = await supabase
    .from("buergerfrage")
    .update(update)
    .eq("id", bfId);
  if (updErr) {
    // Rollback nur bei neu angelegtem FAQ — bei einer Aktualisierung
    // bleibt der vorherige Antwort-Text leider verloren (Versionierungs-
    // Trigger archive_faq_version hält die Historie aber vor).
    if (!istAktualisierung) {
      await supabase.from("faq").delete().eq("id", faqId);
    }
    return { ok: false, message: `Freigabe fehlgeschlagen: ${updErr.message}` };
  }

  revalidiereFAQSeiten();
  return {
    ok: true,
    message: istAktualisierung
      ? "Antwort freigegeben und bestehendes FAQ aktualisiert."
      : "Antwort freigegeben und ins FAQ übernommen.",
  };
}

/**
 * Gibt die Fachstellen-Antwort unverändert frei und legt sie als FAQ an.
 * Schneller Weg ohne Redaktions-Dialog für den 1:1-Fall.
 */
export async function freigebeBuergerfrage1zu1(
  id: string,
): Promise<DashboardActionState> {
  const profile = await requireRecht("anfrage.freigeben");
  const supabase = await createClient();
  const { data: bf, error } = await supabase
    .from("buergerfrage")
    .select("status, antwort_text, ins_faq_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !bf) {
    return { ok: false, message: "Bürgerfrage nicht gefunden." };
  }
  if (bf.status !== "antwort_eingegangen") {
    return {
      ok: false,
      message: "Nur Anfragen mit eingegangener Antwort können freigegeben werden.",
    };
  }
  if (bf.ins_faq_id) {
    return { ok: false, message: "Anfrage ist bereits freigegeben." };
  }
  const original = bf.antwort_text?.trim();
  if (!original) {
    return { ok: false, message: "Keine Antwort der Fachstelle vorhanden." };
  }
  return freigebenUndAlsFaqUebernehmen(id, original, null, profile.id);
}

export async function bearbeiteUndFreigebenBuergerfrage(input: {
  id: string;
  frage_text: string;
  kategorie_id: string | null;
  redaktion: string;
}): Promise<DashboardActionState> {
  const profile = await requireRecht("anfrage.freigeben");
  const frage = input.frage_text.trim();
  if (frage.length < 5) {
    return { ok: false, message: "Frage ist zu kurz." };
  }
  const redaktion = input.redaktion.trim();
  if (redaktion.length < 3) {
    return { ok: false, message: "Antwort fehlt." };
  }

  const supabase = await createClient();

  // Statusprüfung vorab — verhindert Race-Conditions (z. B. doppelter Klick
  // oder zweiter Tab), die sonst zu einem Doppel-FAQ oder einer Freigabe
  // ohne Antwort führen könnten.
  const { data: aktuell, error: ladeErr } = await supabase
    .from("buergerfrage")
    .select("status, ins_faq_id")
    .eq("id", input.id)
    .maybeSingle();
  if (ladeErr || !aktuell) {
    return { ok: false, message: "Bürgerfrage nicht gefunden." };
  }
  if (aktuell.status !== "antwort_eingegangen") {
    return {
      ok: false,
      message: "Status hat sich geändert. Bitte Seite neu laden.",
    };
  }
  if (aktuell.ins_faq_id) {
    return { ok: false, message: "Anfrage ist bereits freigegeben." };
  }

  // Frage/Kategorie aktualisieren — Fachstellen-E-Mail wird ausschließlich
  // über sendeAnFachstelle gesetzt.
  const { error: updErr } = await supabase
    .from("buergerfrage")
    .update({
      frage_text: frage,
      kategorie_id: input.kategorie_id || null,
    })
    .eq("id", input.id);
  if (updErr) {
    return { ok: false, message: `Aktualisierung fehlgeschlagen: ${updErr.message}` };
  }

  const { data: bf } = await supabase
    .from("buergerfrage")
    .select("antwort_text")
    .eq("id", input.id)
    .maybeSingle();
  const original = bf?.antwort_text?.trim() ?? "";

  // Wenn Redaktion identisch zum Original → 1:1-Freigabe ohne Redaktion-Eintrag
  const istIdentisch = redaktion === original;
  return freigebenUndAlsFaqUebernehmen(
    input.id,
    redaktion,
    istIdentisch ? null : redaktion,
    profile.id,
  );
}

export async function bearbeiteFreigegebeneBuergerfrage(input: {
  id: string;
  frage_text: string;
  kategorie_id: string | null;
  redaktion: string;
}): Promise<DashboardActionState> {
  await requireRecht("anfrage.freigeben");
  const frage = input.frage_text.trim();
  if (frage.length < 5) {
    return { ok: false, message: "Frage ist zu kurz." };
  }
  const redaktion = input.redaktion.trim();
  if (redaktion.length < 3) {
    return { ok: false, message: "Antwort fehlt." };
  }

  const supabase = await createClient();

  const { data: bf, error: ladeErr } = await supabase
    .from("buergerfrage")
    .select("ins_faq_id, antwort_text, bezug_faq_id")
    .eq("id", input.id)
    .maybeSingle();
  if (ladeErr || !bf) {
    return { ok: false, message: "Bürgerfrage nicht gefunden." };
  }

  const original = bf.antwort_text?.trim() ?? "";
  const istIdentisch = redaktion === original;
  // Effektive öffentliche Antwort — spiegelt die View-Logik
  // antwort_oeffentlich = COALESCE(antwort_redaktion, antwort_text).
  // FAQ und View müssen denselben Text führen, sonst driften sie auseinander.
  const effektiveAntwort = istIdentisch ? original : redaktion;

  const { error: updErr } = await supabase
    .from("buergerfrage")
    .update({
      frage_text: frage,
      kategorie_id: input.kategorie_id || null,
      antwort_redaktion: istIdentisch ? null : redaktion,
    })
    .eq("id", input.id);
  if (updErr) {
    return { ok: false, message: `Aktualisierung fehlgeschlagen: ${updErr.message}` };
  }

  // Falls bereits ein FAQ angelegt/aktualisiert wurde, dieses synchron halten.
  // Bei einer Rückfrage (bezug_faq_id gesetzt) bleibt die FAQ-Frage und
  // Kategorie unverändert — nur die Antwort wird gespiegelt.
  if (bf.ins_faq_id) {
    const faqUpdate: Record<string, unknown> = {
      antwort: effektiveAntwort,
      stand_at: new Date().toISOString(),
    };
    if (!bf.bezug_faq_id) {
      faqUpdate.frage = frage;
      faqUpdate.kategorie_id = input.kategorie_id || null;
    }
    const { error: faqErr } = await supabase
      .from("faq")
      .update(faqUpdate)
      .eq("id", bf.ins_faq_id);
    if (faqErr) {
      return { ok: false, message: `FAQ-Aktualisierung fehlgeschlagen: ${faqErr.message}` };
    }
  }

  revalidiereFAQSeiten();
  return { ok: true, message: "Aktualisiert." };
}

export async function sendeAnFachstelle(
  _prev: DashboardActionState | undefined,
  formData: FormData,
): Promise<DashboardActionState> {
  const profile = await requireRecht("anfrage.an_fachstelle");
  const id = formData.get("id") as string | null;
  if (!id) return { ok: false, message: "Keine Frage angegeben." };

  // Multi-Mail-Eingabe: Komma-/Semikolon-/Zeilengetrennt.
  // Fallback auf das alte Single-Feld für Backwards-Compat.
  const empfaengerRaw =
    ((formData.get("empfaenger_emails") as string | null) || "").trim() ||
    ((formData.get("neue_fachstelle_email") as string | null) || "").trim();
  const empfaenger = parseEmpfaengerEmails(empfaengerRaw);

  const supabase = await createClient();

  if (empfaenger.length > 0) {
    // Mind. eine ungültige Adresse → komplett ablehnen, sonst entstehen
    // halb-versendete Zustände.
    const ungueltig = empfaenger.filter((e) => !e.includes("@"));
    if (ungueltig.length > 0) {
      return {
        ok: false,
        message: `Ungültige E-Mail-Adresse: ${ungueltig.join(", ")}`,
      };
    }
    // Die erste Adresse wird zur "primären" Fachstellen-Mail
    // (Anzeige im Dashboard, Default bei Wiederaufnahme).
    const { error: updErr } = await supabase
      .from("buergerfrage")
      .update({ fachstelle_email: empfaenger[0] })
      .eq("id", id);
    if (updErr) {
      return {
        ok: false,
        message: `E-Mail-Aktualisierung fehlgeschlagen: ${updErr.message}`,
      };
    }
  }

  // Frage holen für E-Mail-Inhalt
  const { data: frage, error: ladenErr } = await supabase
    .from("buergerfrage_view")
    .select("frage_text, fachstelle_email")
    .eq("id", id)
    .maybeSingle();
  if (ladenErr || !frage) {
    return { ok: false, message: "Frage nicht gefunden." };
  }

  // Wenn keine Empfänger explizit angegeben wurden, nutze die hinterlegte
  // fachstelle_email (Erneut-Senden ohne Adresswechsel).
  const ziele = empfaenger.length > 0
    ? empfaenger
    : frage.fachstelle_email
      ? [frage.fachstelle_email]
      : [];
  if (ziele.length === 0) {
    return { ok: false, message: "Keine Fachstellen-E-Mail hinterlegt." };
  }

  const origin = await getRequestOrigin();
  // Ein einziger Token für alle Empfänger. Die Adressen werden kommasepariert
  // in fachstellen_token.empfaenger_email gespeichert. EIN gemeinsamer Link
  // für alle Empfänger; First-Answer-Wins-Lock erfolgt über den Status der
  // Bürgerfrage (submit_fachstellen_antwort).
  const empfaengerDisplay = ziele.join(", ");
  const { data: token, error: tokenErr } = await supabase.rpc(
    "request_fachstellen_link",
    { p_buergerfrage_id: id, p_email: empfaengerDisplay },
  );
  if (tokenErr || !token) {
    return {
      ok: false,
      message: `Token-Anlage fehlgeschlagen: ${tokenErr?.message ?? "unbekannt"}`,
    };
  }
  const link = `${origin}/antworten/${token}`;
  const behoerdeName = await ladeBehoerdeName(supabase, profile.behoerde_id);
  const { subject, text, html } = baueFachstellenMail(link, frage.frage_text, "neu", behoerdeName);

  // Token besteht — jetzt verschickt die App die Mail selbst. Es gibt bewusst
  // keinen mailto-Fallback mehr; bei Fehler erhält der Nutzer eine klare
  // Meldung und kann erneut senden (dabei entsteht ein neuer Token).
  const mail = await sendeMail({
    to: ziele,
    replyTo: profile.email,
    subject,
    text,
    html,
    fromName: `Bürgertelefon ${behoerdeName}`.trim(),
  });
  if (!mail.ok) return { ok: false, message: versandFehlerText(mail) };

  revalidatePath("/dashboard");
  return { ok: true, message: `An Fachstelle gesendet (${empfaengerDisplay}).` };
}

export async function erneutAnFachstelle(input: {
  id: string;
  rueckfrage: string;
  neue_email?: string | null;
}): Promise<DashboardActionState> {
  const profile = await requireRecht("anfrage.freigeben");

  const rueckfrage = input.rueckfrage.trim();
  if (rueckfrage.length < 5) {
    return {
      ok: false,
      message: "Bitte die Rückfrage etwas ausführlicher formulieren.",
    };
  }
  const neueEmail = input.neue_email?.trim() || null;
  if (neueEmail && !neueEmail.includes("@")) {
    return { ok: false, message: "Fachstellen-E-Mail ist ungültig." };
  }

  const supabase = await createClient();

  // Atomar: bisherige Antwort ins Protokoll archivieren, Rückfrage
  // protokollieren, Antwortfelder leeren (Status zurück auf bei_fachstelle)
  // und neuen Token erzeugen. Statusprüfung passiert in der SQL-Funktion.
  const { data: token, error: rpcErr } = await supabase.rpc(
    "stelle_rueckfrage",
    {
      p_buergerfrage_id: input.id,
      p_rueckfrage: rueckfrage,
      p_email: neueEmail,
    },
  );
  if (rpcErr || !token) {
    return {
      ok: false,
      message: `Rückfrage fehlgeschlagen: ${rpcErr?.message ?? "unbekannt"}`,
    };
  }

  // Empfänger für die E-Mail bestimmen (neue Adresse oder die jetzt
  // hinterlegte primäre Fachstellen-Mail).
  const { data: frage, error: frageErr } = await supabase
    .from("buergerfrage_view")
    .select("fachstelle_email")
    .eq("id", input.id)
    .maybeSingle();
  if (frageErr) logger.error("buergerfrage_view-Load nach stelle_rueckfrage fehlgeschlagen", frageErr);
  const empfaenger = neueEmail || frage?.fachstelle_email || null;
  if (!empfaenger) {
    return {
      ok: false,
      message: "Keine Fachstellen-E-Mail hinterlegt. Bitte E-Mail-Adresse angeben.",
    };
  }

  const link = `${await getRequestOrigin()}/antworten/${token}`;
  const behoerdeName = await ladeBehoerdeName(supabase, profile.behoerde_id);
  const { subject, text, html } = baueFachstellenMail(link, rueckfrage, "rueckfrage", behoerdeName);

  const mail = await sendeMail({
    to: empfaenger,
    replyTo: profile.email,
    subject,
    text,
    html,
    fromName: `Bürgertelefon ${behoerdeName}`.trim(),
  });
  if (!mail.ok) return { ok: false, message: versandFehlerText(mail) };

  revalidatePath("/dashboard");
  return { ok: true, message: `Rückfrage an Fachstelle gesendet (${empfaenger}).` };
}

export async function bearbeiteBuergerfrage(input: {
  id: string;
  frage_text: string;
  kategorie_id: string | null;
}): Promise<DashboardActionState> {
  await requireRecht("anfrage.freigeben");
  const frage = input.frage_text.trim();
  if (frage.length < 5) {
    return { ok: false, message: "Frage ist zu kurz." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("buergerfrage")
    .update({
      frage_text: frage,
      kategorie_id: input.kategorie_id || null,
    })
    .eq("id", input.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: "Bürgerfrage aktualisiert." };
}

export async function loescheBuergerfrage(
  _prev: DashboardActionState | undefined,
  formData: FormData,
): Promise<DashboardActionState> {
  await requireRecht("anfrage.freigeben");
  const id = formData.get("id") as string | null;
  if (!id) return { ok: false, message: "Keine Frage angegeben." };
  const supabase = await createClient();
  const { error } = await supabase.from("buergerfrage").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: "Bürgerfrage gelöscht." };
}

export async function ergaenzeAntwortManuell(input: {
  id: string;
  antwort_text: string;
  antwort_von_name: string | null;
  antwort_von_email: string | null;
}): Promise<DashboardActionState> {
  await requireRecht("anfrage.freigeben");
  const text = input.antwort_text.trim();
  if (text.length < 3) {
    return { ok: false, message: "Antworttext fehlt." };
  }
  const name = input.antwort_von_name?.trim() || null;
  const von = input.antwort_von_email?.trim() || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("buergerfrage")
    .update({
      status: "antwort_eingegangen",
      antwort_text: text,
      antwort_von_name: name,
      antwort_von_email: von,
      antwort_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: "Antwort eingetragen — Freigabe ausstehend." };
}
