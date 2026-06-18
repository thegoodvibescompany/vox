import type { KartenFarbe } from "@/lib/types";

export const KARTEN_FARBEN: KartenFarbe[] = [
  "rot",
  "orange",
  "gelb",
  "gruen",
  "blau",
  "lila",
  "grau",
];

export const FARBE_LABEL: Record<KartenFarbe, string> = {
  rot: "Rot",
  orange: "Orange",
  gelb: "Gelb",
  gruen: "Grün",
  blau: "Blau",
  lila: "Lila",
  grau: "Grau",
};

// Hex-Codes für Leaflet-Layer (Tailwind ~600er Töne).
export const FARBE_HEX: Record<KartenFarbe, string> = {
  rot: "#dc2626",
  orange: "#ea580c",
  gelb: "#ca8a04",
  gruen: "#16a34a",
  blau: "#1d4ed8",
  lila: "#7c3aed",
  grau: "#525252",
};

// Tailwind-Klassen für die UI (Swatch, Icon-Hintergrund etc.).
export const FARBE_BG: Record<KartenFarbe, string> = {
  rot: "bg-red-600",
  orange: "bg-orange-600",
  gelb: "bg-yellow-600",
  gruen: "bg-green-600",
  blau: "bg-blue-700",
  lila: "bg-violet-600",
  grau: "bg-stone-600",
};

export const FARBE_TEXT: Record<KartenFarbe, string> = {
  rot: "text-red-600",
  orange: "text-orange-600",
  gelb: "text-yellow-600",
  gruen: "text-green-600",
  blau: "text-blue-700",
  lila: "text-violet-600",
  grau: "text-stone-600",
};

export function istKartenFarbe(value: unknown): value is KartenFarbe {
  return (
    typeof value === "string" &&
    (KARTEN_FARBEN as string[]).includes(value)
  );
}
