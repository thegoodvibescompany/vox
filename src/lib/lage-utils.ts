// Reine Funktionen ohne Server-Abhängigkeit. Sicher in Server- UND
// Client-Komponenten verwendbar.

// Feste Zeitzone Europe/Berlin (Sommer- und Winterzeit werden vom Browser/
// V8 automatisch korrekt aufgelöst). Ohne explizite Zeitzone formatiert der
// Server in UTC, wodurch Zeitangaben um 1 bzw. 2 Stunden verschoben wären.
export function formatDeDatumZeit(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
