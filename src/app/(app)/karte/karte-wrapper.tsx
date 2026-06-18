"use client";

import dynamic from "next/dynamic";
import type { Kartenobjekt } from "@/lib/types";

const KartenApp = dynamic(() => import("./karten-app"), {
  ssr: false,
  loading: () => (
    <div className="container mx-auto px-4 py-12 max-w-3xl text-center text-muted-foreground">
      Karte wird geladen …
    </div>
  ),
});

export function KarteWrapper({
  objekte,
  darfBearbeiten,
  center,
  zoom,
}: {
  objekte: Kartenobjekt[];
  darfBearbeiten: boolean;
  center: [number, number];
  zoom: number;
}) {
  return (
    <KartenApp
      objekte={objekte}
      darfBearbeiten={darfBearbeiten}
      center={center}
      zoom={zoom}
    />
  );
}
