"use client";

import { useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KartenFokus } from "./karten-fokus-input";

const ZENTRUM_DEUTSCHLAND: [number, number] = [51.1638, 10.4478];

// Roter Pin als DivIcon — braucht keine Bild-Assets (anders als das
// Leaflet-Default-Icon, das sonst einen Pfad-Fix bräuchte).
const PIN_ICON = L.divIcon({
  html: `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#dc2626" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
  <circle cx="12" cy="10" r="3" fill="white" stroke="#dc2626"/>
</svg>`,
  className: "vox-fokus-pin",
  iconSize: [32, 32],
  iconAnchor: [16, 30],
});

type Treffer = { lat: string; lon: string; display_name: string };

/**
 * Reduziert einen vollen Anzeigenamen (Stadt, Region, Land) auf die Stadt.
 */
function kuerzeStadtname(displayName: string): string {
  const teil = displayName.split(",")[0]?.trim();
  return teil && teil.length > 0 ? teil : displayName;
}

/**
 * Reverse-Geocoding über Nominatim: zu Lat/Lon den Ortsnamen ermitteln.
 * Best effort — schlägt es fehl, wird ein neutraler Platzhalter genutzt.
 */
async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=12&accept-language=de&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { "Accept-Language": "de" }, signal });
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    return (
      a.city ||
      a.town ||
      a.village ||
      a.municipality ||
      a.county ||
      (data.display_name ? kuerzeStadtname(data.display_name) : "") ||
      "Gewählter Punkt"
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "";
    return "Gewählter Punkt";
  }
}

// Fängt Klicks auf die Karte ab und meldet die Koordinaten nach oben.
function KlickHandler({
  onKlick,
}: {
  onKlick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      onKlick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Interaktiver Karten-Fokus-Picker. Stadt suchen oder direkt auf die Karte
 * klicken; der gewählte Punkt wird als { city, lat, lon } gespeichert
 * (verstecktes Feld unter `name`) und über `onChange` nach oben gemeldet.
 *
 * Wird nur client-seitig geladen (siehe Wrapper in karten-fokus-input.tsx),
 * da Leaflet auf window zugreift.
 */
export default function KartenFokusMap({
  name,
  initial,
  onChange,
}: {
  name: string;
  initial: KartenFokus | null;
  onChange?: (fokus: KartenFokus | null) => void;
}) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [query, setQuery] = useState(initial?.city ?? "");
  const [pending, setPending] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [gewaehlt, setGewaehlt] = useState<KartenFokus | null>(initial);
  const geocodeAbort = useRef<AbortController | null>(null);

  const startCenter: [number, number] = initial
    ? [initial.lat, initial.lon]
    : ZENTRUM_DEUTSCHLAND;
  const startZoom = initial ? 13 : 11;

  function applyFokus(fokus: KartenFokus | null) {
    setGewaehlt(fokus);
    onChange?.(fokus);
  }

  async function suche() {
    const q = query.trim();
    if (!q) return;
    setPending(true);
    setHinweis(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=de&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { "Accept-Language": "de" } });
      const data = (await res.json()) as Treffer[];
      const treffer = data?.[0];
      if (!treffer) {
        setHinweis("Kein Ort gefunden.");
        return;
      }
      const lat = Number(treffer.lat);
      const lon = Number(treffer.lon);
      const city = kuerzeStadtname(treffer.display_name);
      map?.setView([lat, lon], 13);
      applyFokus({ city, lat, lon });
    } catch (err) {
      setHinweis(
        `Suche fehlgeschlagen: ${err instanceof Error ? err.message : "unbekannt"}`,
      );
    } finally {
      setPending(false);
    }
  }

  function handleKlick(lat: number, lon: number) {
    geocodeAbort.current?.abort();
    const controller = new AbortController();
    geocodeAbort.current = controller;

    setHinweis(null);
    applyFokus({ city: "wird ermittelt …", lat, lon });
    void (async () => {
      const city = await reverseGeocode(lat, lon, controller.signal);
      if (controller.signal.aborted || !city) return;
      applyFokus({ city, lat, lon });
      setQuery(city);
    })();
  }

  return (
    <div className="space-y-2">
      <Label>Karten-Fokus</Label>
      <p className="text-xs text-muted-foreground">
        Stadt suchen oder auf die Karte klicken, um den Kartenausschnitt der
        Lage festzulegen.
      </p>

      <div className="relative h-72 w-full overflow-hidden rounded-md border">
        <MapContainer
          ref={setMap}
          center={startCenter}
          zoom={startZoom}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Mitwirkende'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <KlickHandler onKlick={handleKlick} />
          {gewaehlt && (
            <Marker position={[gewaehlt.lat, gewaehlt.lon]} icon={PIN_ICON} />
          )}
        </MapContainer>

        <div className="absolute left-2 top-2 z-[1000] flex w-64 max-w-[calc(100%-1rem)] gap-2 rounded-md border bg-white p-2 shadow-md">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                suche();
              }
            }}
            placeholder="Stadt suchen …"
            className="h-8"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={suche}
            disabled={pending || !query.trim()}
            aria-label="Stadt suchen"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {hinweis && <p className="text-xs text-red-700">{hinweis}</p>}

      {gewaehlt && (
        <p className="text-xs text-emerald-700">
          Fokus: <span className="font-medium">{gewaehlt.city}</span> (
          {gewaehlt.lat.toFixed(4)}, {gewaehlt.lon.toFixed(4)})
        </p>
      )}

      <input
        type="hidden"
        name={name}
        value={gewaehlt ? JSON.stringify(gewaehlt) : ""}
      />
    </div>
  );
}
