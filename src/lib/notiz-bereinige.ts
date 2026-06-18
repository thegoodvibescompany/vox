// Bereinigt einen Notiz-Inhalt: trimmt, schneidet auf Maximallänge und
// gibt null zurück, wenn nach dem Trimmen nichts übrig bleibt.
// Bewusst ohne "use server"-Marker, damit aus Tests importierbar.

export const NOTIZ_MAX_LEN = 4000;

export function bereinigeNotizInhalt(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const text = input.trim();
  if (text.length === 0) return null;
  if (text.length > NOTIZ_MAX_LEN) return text.slice(0, NOTIZ_MAX_LEN);
  return text;
}
