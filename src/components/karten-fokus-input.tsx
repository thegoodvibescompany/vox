"use client";

import dynamic from "next/dynamic";

export type KartenFokus = {
  city: string;
  lat: number;
  lon: number;
};

// Leaflet greift auf window zu → nur client-seitig laden.
const KartenFokusMap = dynamic(() => import("./karten-fokus-map"), {
  ssr: false,
  loading: () => (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Karten-Fokus</p>
      <div className="flex h-72 w-full items-center justify-center rounded-md border text-sm text-muted-foreground">
        Karte wird geladen …
      </div>
    </div>
  ),
});

/**
 * Eingabe für den „Karten-Fokus": Auswahl des Punkts, auf den die Karte zur
 * Lage zentriert wird. Dünner Wrapper, der die eigentliche Leaflet-Karte nur
 * im Browser lädt.
 */
export function KartenFokusInput({
  name,
  initial,
  onChange,
}: {
  name: string;
  initial: KartenFokus | null;
  onChange?: (fokus: KartenFokus | null) => void;
}) {
  return <KartenFokusMap name={name} initial={initial} onChange={onChange} />;
}
