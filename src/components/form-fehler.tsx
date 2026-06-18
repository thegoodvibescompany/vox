import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Inline-Fehlerhinweis in Formularen — die Eingabe bleibt sichtbar, damit der
 * Nutzer korrigieren kann (anders als die ersetzenden Erfolgs-Bestätigungen).
 */
export function FormFehler({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-red-700" role="status">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </p>
  );
}
