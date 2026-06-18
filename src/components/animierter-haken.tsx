import { cn } from "@/lib/utils";

/**
 * Erfolgs-Haken, der sich zeichnet (erst der Kreis, dann das Häkchen). Für
 * abgeschlossene, belohnende Momente wie „Antwort gesendet" oder „Domain
 * verifiziert" — bewusst anders als der monochrome Magic-Link-Brief (der nur
 * „unterwegs" signalisiert). Reine CSS-Animation, respektiert
 * prefers-reduced-motion (dann erscheint der Haken ruhig, ohne Zeichnen).
 */
export function AnimierterHaken({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 52 52"
      className={cn("size-16 text-emerald-600", className)}
      role="img"
      aria-label="Erfolgreich"
    >
      <circle
        className="haken-kreis"
        cx="26"
        cy="26"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        className="haken-pfad"
        d="M15 27 l8 8 l16 -16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
