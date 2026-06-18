/**
 * Gemeinsames HTML-Layout für die App-Mails (Fachstellen-Strecke).
 *
 * Designprinzipien für robuste E-Mail-Darstellung:
 *  - Tabellen-Layout statt Flex/Grid (Outlook & Co. rendern sonst kaputt).
 *  - Ausschließlich Inline-CSS (viele Clients strippen <style>-Blöcke).
 *  - Feste 600px-Breite, monochrome Stone-Palette wie das VOX-Interface.
 *  - Jede HTML-Mail trägt immer eine gleichwertige Plaintext-Variante (in
 *    `mail.ts` als multipart/alternative versendet).
 *
 * Die Auth-Mails (Magic-Link/Bestätigung) nutzen dieses Modul NICHT — sie sind
 * statische HTML-Dateien mit Go-Template-Variablen, die GoTrue selbst rendert.
 * Beide Welten teilen sich aber bewusst dieselbe visuelle Sprache.
 */

/** Escaped Text für die Einbettung in HTML (Inhalt wie Attribute). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

type Layout = {
  /** Versteckter Vorschautext im Posteingang (Preheader). */
  preheader: string;
  /** Überschrift in der Karte. */
  heading: string;
  /** Einleitende Absätze als fertiges (statisches) HTML. */
  introHtml: string;
  /** Optional hervorgehobener Zitatblock, z. B. die Bürgerfrage. */
  quote?: { label: string; text: string };
  /** Optionaler Haupt-Button. */
  button?: { label: string; url: string };
  /** Klartext-Link unter dem Button (Fallback bei nicht klickbarem Button). */
  linkFallbackUrl?: string;
  /** Kleiner Hinweis unter dem Inhalt (z. B. Gültigkeitsdauer). */
  noteHtml?: string;
  /** Grußzeile/Signatur, z. B. „Bürgertelefon {Behörde}". */
  signature?: string;
};

function buttonBlock(button: { label: string; url: string }): string {
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                <tr>
                  <td align="center" bgcolor="#1c1917" style="border-radius:8px;">
                    <a href="${escapeHtml(button.url)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(button.label)}</a>
                  </td>
                </tr>
              </table>`;
}

function quoteBlock(quote: { label: string; text: string }): string {
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                <tr>
                  <td style="border-left:3px solid #1c1917;background-color:#fafaf9;padding:14px 18px;border-radius:0 6px 6px 0;">
                    <div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:#78716c;margin-bottom:6px;">${escapeHtml(quote.label)}</div>
                    <div style="font-family:${FONT};font-size:15px;line-height:1.55;color:#292524;white-space:pre-wrap;">${escapeHtml(quote.text)}</div>
                  </td>
                </tr>
              </table>`;
}

function linkFallbackBlock(url: string): string {
  return `
              <p style="font-family:${FONT};font-size:13px;line-height:1.5;color:#78716c;margin:16px 0 0;">
                Falls der Button nicht funktioniert, diesen Link in den Browser kopieren:<br />
                <a href="${escapeHtml(url)}" target="_blank" style="color:#1c1917;word-break:break-all;">${escapeHtml(url)}</a>
              </p>`;
}

/** Baut ein vollständiges HTML-Mail-Dokument im VOX-Layout. */
export function baueMailLayout(layout: Layout): string {
  const parts: string[] = [];
  parts.push(layout.introHtml);
  if (layout.quote) parts.push(quoteBlock(layout.quote));
  if (layout.button) parts.push(buttonBlock(layout.button));
  if (layout.linkFallbackUrl) parts.push(linkFallbackBlock(layout.linkFallbackUrl));
  if (layout.noteHtml) {
    parts.push(`
              <p style="font-family:${FONT};font-size:13px;line-height:1.55;color:#78716c;margin:24px 0 0;padding-top:16px;border-top:1px solid #e7e5e4;">${layout.noteHtml}</p>`);
  }
  if (layout.signature) {
    const sig = escapeHtml(layout.signature).replace(/\n/g, "<br />");
    parts.push(`
              <p style="font-family:${FONT};font-size:15px;line-height:1.55;color:#44403c;margin:24px 0 0;">${sig}</p>`);
  }

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(layout.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(layout.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f4;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">
          <tr>
            <td style="padding:0 4px 18px;">
              <span style="font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:2px;color:#1c1917;">VOX</span>
              <span style="font-family:${FONT};font-size:13px;color:#a8a29e;">&nbsp;·&nbsp;Bürgertelefon</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e7e5e4;border-radius:12px;padding:32px;">
              <h1 style="font-family:${FONT};font-size:20px;font-weight:700;line-height:1.3;color:#1c1917;margin:0 0 18px;">${escapeHtml(layout.heading)}</h1>${parts.join("")}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 4px 0;">
              <p style="font-family:${FONT};font-size:12px;line-height:1.5;color:#a8a29e;margin:0;">
                Diese E-Mail wurde automatisch über das Bürgertelefon-System VOX versendet. Bitte antworten Sie über den enthaltenen Link, nicht auf diese Nachricht.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
