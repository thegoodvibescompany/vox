"use client";

import { ArrowLeft } from "lucide-react";

/** Schlichter „← Zurück"-Schalter für die mehrstufigen Auth-Ansichten. */
export function ZurueckKnopf({
  onClick,
  label = "Zurück",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900"
    >
      <ArrowLeft className="size-4" />
      {label}
    </button>
  );
}
