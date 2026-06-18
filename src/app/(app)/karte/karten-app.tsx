"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAutoRefresh } from "@/lib/use-auto-refresh";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L, { type FeatureGroup as LFeatureGroup } from "leaflet";
import "leaflet-draw";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint, polygon as turfPolygon } from "@turf/helpers";
import type { Feature, Geometry, Point as GJPoint, Polygon as GJPolygon } from "geojson";
import { Circle as IconCircle, MapPin, Minus, Pencil, Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import {
  speichereKartenobjekt,
  aktualisiereKartenobjekt,
  loescheKartenobjekt,
} from "./actions";
import type { KartenFarbe, Kartenobjekt, KartenTyp } from "@/lib/types";
import {
  FARBE_BG,
  FARBE_HEX,
  FARBE_LABEL,
  FARBE_TEXT,
  KARTEN_FARBEN,
} from "@/lib/karten-farbe";
import { logger } from "@/lib/logger";

type GeocodeTreffer = {
  lat: number;
  lon: number;
  display_name: string;
};

type NeueGeometrie = {
  typ: KartenTyp;
  geometry: Geometry;
  radius_m: number | null;
};

function defaultFarbe(typ: KartenTyp): KartenFarbe {
  return typ === "linie" ? "blau" : "rot";
}

export default function KartenApp({
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
  const [bearbeitet, setBearbeitet] = useState<Kartenobjekt | null>(null);

  // Realtime: andere Clients sehen Änderungen ohne Reload.
  useAutoRefresh();

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <h1 className="text-2xl font-semibold mb-3">Karte zur aktuellen Lage</h1>
      <p className="text-sm text-muted-foreground mb-4">
        {darfBearbeiten
          ? "Zeichne Bereiche, Linien, Punkte oder Kreise mit den Werkzeugen oben links ein. Prüfe Adressen rechts oben gegen die eingezeichneten Bereiche."
          : "Sieh die eingezeichneten Bereiche und Punkte zur Lage. Prüfe Adressen rechts oben gegen die eingezeichneten Bereiche."}
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="relative isolate h-[640px] w-full rounded-lg overflow-hidden border">
          <MapContainer
            center={center}
            zoom={zoom}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Mitwirkende'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <KartenInhalt objekte={objekte} darfBearbeiten={darfBearbeiten} />
          </MapContainer>
        </div>

        <ObjektListe
          objekte={objekte}
          darfBearbeiten={darfBearbeiten}
          onEdit={setBearbeitet}
        />
      </div>

      <BearbeitenDialog
        objekt={bearbeitet}
        onClose={() => setBearbeitet(null)}
      />
    </div>
  );
}

function ObjektListe({
  objekte,
  darfBearbeiten,
  onEdit,
}: {
  objekte: Kartenobjekt[];
  darfBearbeiten: boolean;
  onEdit: (o: Kartenobjekt) => void;
}) {
  const router = useRouter();

  return (
    <aside className="space-y-3">
      <h2 className="text-sm font-semibold">Vorhandene Objekte</h2>
      {objekte.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Objekte eingezeichnet.
        </p>
      ) : (
        <ul className="space-y-2">
          {objekte.map((o) => (
            <li
              key={o.id}
              className="flex items-start gap-3 rounded-md border bg-white p-3 text-sm"
            >
              <TypIcon typ={o.typ} farbe={o.farbe} />
              <div className="flex-1 min-w-0">
                <div className="font-medium leading-snug break-words">
                  {o.titel}
                </div>
                <div className="text-xs text-muted-foreground">
                  {labelFuerTyp(o.typ)}
                  {o.typ === "kreis" && o.radius_m
                    ? ` · ${formatRadius(o.radius_m)}`
                    : ""}{" "}
                  · {FARBE_LABEL[o.farbe]}
                </div>
                {o.beschreibung && (
                  <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                    {o.beschreibung}
                  </div>
                )}
                {darfBearbeiten && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(o)}
                      aria-label="Bearbeiten"
                      title="Bearbeiten"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!confirm(`„${o.titel}" wirklich löschen?`)) return;
                        const r = await loescheKartenobjekt(o.id);
                        if (r.ok) {
                          toast.success(r.message);
                          router.refresh();
                        } else toast.error(r.message);
                      }}
                      aria-label="Löschen"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function TypIcon({ typ, farbe }: { typ: KartenTyp; farbe: KartenFarbe }) {
  const cls = `w-5 h-5 ${FARBE_TEXT[farbe]}`;
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-stone-100 shrink-0">
      {typ === "punkt" && <MapPin className={cls} />}
      {typ === "kreis" && <IconCircle className={cls} />}
      {typ === "polygon" && <Square className={cls} />}
      {typ === "linie" && <Minus className={cls} />}
    </span>
  );
}

function labelFuerTyp(t: KartenTyp): string {
  if (t === "polygon") return "Polygon";
  if (t === "linie") return "Linie";
  if (t === "kreis") return "Kreis";
  return "Punkt";
}

function formatRadius(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

function divIconFuerPunkt(farbe: KartenFarbe): L.DivIcon {
  const hex = FARBE_HEX[farbe];
  // Pin-SVG (lucide MapPin) zentriert, Anchor unten an der Spitze
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${hex}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
  <circle cx="12" cy="10" r="3" fill="white" stroke="${hex}"/>
</svg>`;
  return L.divIcon({
    html: svg,
    className: "vox-punkt-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 30],
    popupAnchor: [0, -28],
  });
}

function KartenInhalt({
  objekte,
  darfBearbeiten,
}: {
  objekte: Kartenobjekt[];
  darfBearbeiten: boolean;
}) {
  const map = useMap();
  const groupRef = useRef<LFeatureGroup | null>(null);
  const layerRef = useRef<L.Layer | null>(null);
  const sucheMarkerRef = useRef<L.Marker | null>(null);
  const [neueGeometrie, setNeueGeometrie] = useState<NeueGeometrie | null>(null);

  // Default-Marker-Icons brauchen Pfad-Fix (Adress-Suche, Draw-Marker)
  useEffect(() => {
    type IconDefaultPrototype = {
      _getIconUrl?: () => void;
    };
    const proto = L.Icon.Default.prototype as IconDefaultPrototype;
    delete proto._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
  }, []);

  // Vorhandene Polygone bzw. Kreise für den Adress-Check vorbereiten
  const polygonsForCheck = useMemo(() => {
    return objekte
      .filter((o) => o.typ === "polygon")
      .map((o) => ({ id: o.id, titel: o.titel, geom: o.geometry as GJPolygon }));
  }, [objekte]);

  const kreiseForCheck = useMemo(() => {
    return objekte
      .filter((o) => o.typ === "kreis" && o.radius_m)
      .map((o) => {
        const pt = o.geometry as GJPoint;
        return {
          id: o.id,
          titel: o.titel,
          lat: pt.coordinates[1],
          lon: pt.coordinates[0],
          radius_m: o.radius_m as number,
        };
      });
  }, [objekte]);

  // Vorhandene Objekte rendern
  useEffect(() => {
    const layers: L.Layer[] = [];
    for (const o of objekte) {
      const farbeHex = FARBE_HEX[o.farbe];
      let layer: L.Layer;
      if (o.typ === "kreis" && o.radius_m) {
        const pt = o.geometry as GJPoint;
        layer = L.circle([pt.coordinates[1], pt.coordinates[0]], {
          radius: o.radius_m,
          color: farbeHex,
          weight: 2,
          fillColor: farbeHex,
          fillOpacity: 0.15,
        });
      } else if (o.typ === "punkt") {
        const pt = o.geometry as GJPoint;
        layer = L.marker([pt.coordinates[1], pt.coordinates[0]], {
          icon: divIconFuerPunkt(o.farbe),
        });
      } else {
        layer = L.geoJSON(o.geometry as Geometry, {
          style: () =>
            o.typ === "polygon"
              ? {
                  color: farbeHex,
                  weight: 2,
                  fillColor: farbeHex,
                  fillOpacity: 0.15,
                }
              : { color: farbeHex, weight: 4 },
        });
      }
      const popup = `<strong>${escapeHtml(o.titel)}</strong>${
        o.typ === "kreis" && o.radius_m
          ? `<br/>Radius: ${formatRadius(o.radius_m)}`
          : ""
      }${o.beschreibung ? "<br/>" + escapeHtml(o.beschreibung) : ""}`;
      (layer as L.Layer & { bindPopup: (s: string) => void }).bindPopup(popup);
      layer.addTo(map);
      layers.push(layer);
    }
    return () => {
      for (const l of layers) map.removeLayer(l);
    };
  }, [map, objekte]);

  // Zeichen-Werkzeuge nur für Bearbeiter
  useEffect(() => {
    if (!darfBearbeiten) return;
    const group = new L.FeatureGroup();
    group.addTo(map);
    groupRef.current = group;

    type DrawConstructor = new (options: unknown) => L.Control;
    const DrawCtor = (
      L.Control as unknown as { Draw: DrawConstructor }
    ).Draw;

    const drawControl = new DrawCtor({
      position: "topleft",
      edit: { featureGroup: group, edit: false, remove: false },
      draw: {
        polygon: { shapeOptions: { color: "#dc2626" } },
        polyline: { shapeOptions: { color: "#1d4ed8", weight: 4 } },
        marker: true,
        circle: { shapeOptions: { color: "#dc2626" } },
        circlemarker: false,
        rectangle: false,
      },
    });
    map.addControl(drawControl);

    const handler = (e: { layerType: string; layer: L.Layer }) => {
      const layer = e.layer;
      // sichtbar lassen, bis Speichern oder Abbrechen
      group.addLayer(layer);
      layerRef.current = layer;

      if (e.layerType === "circle") {
        const circle = layer as L.Circle;
        const center = circle.getLatLng();
        const radius_m = circle.getRadius();
        const geometry: GJPoint = {
          type: "Point",
          coordinates: [center.lng, center.lat],
        };
        setNeueGeometrie({ typ: "kreis", geometry, radius_m });
      } else {
        type GeoJsonable = { toGeoJSON: () => Feature };
        const feature = (layer as unknown as GeoJsonable).toGeoJSON();
        const typ: KartenTyp =
          e.layerType === "polygon"
            ? "polygon"
            : e.layerType === "polyline"
              ? "linie"
              : "punkt";
        setNeueGeometrie({ typ, geometry: feature.geometry, radius_m: null });
      }
    };
    map.on("draw:created", handler as unknown as L.LeafletEventHandlerFn);

    return () => {
      map.off("draw:created", handler as unknown as L.LeafletEventHandlerFn);
      map.removeControl(drawControl);
      group.remove();
      groupRef.current = null;
      layerRef.current = null;
    };
  }, [map, darfBearbeiten]);

  function entferneTempLayer() {
    const group = groupRef.current;
    const layer = layerRef.current;
    if (group && layer) {
      group.removeLayer(layer);
    }
    layerRef.current = null;
  }

  function dialogSchliessenAbbrechen() {
    entferneTempLayer();
    setNeueGeometrie(null);
  }

  function dialogSchliessenSpeichern() {
    // Server-Action revalidiert /karte; das aktuelle Layer (in der draw-Group)
    // wird durch das Re-Render aus DB-Objekten ersetzt — daher hier
    // nur die Group leeren, damit es nicht doppelt erscheint.
    const group = groupRef.current;
    if (group) group.clearLayers();
    layerRef.current = null;
    setNeueGeometrie(null);
  }

  return (
    <>
      <SucheBox
        map={map}
        markerRef={sucheMarkerRef}
        polygons={polygonsForCheck}
        kreise={kreiseForCheck}
      />
      <SpeichernDialog
        offen={neueGeometrie !== null}
        info={neueGeometrie}
        abbrechen={dialogSchliessenAbbrechen}
        nachSpeichern={dialogSchliessenSpeichern}
      />
    </>
  );
}

function SucheBox({
  map,
  markerRef,
  polygons,
  kreise,
}: {
  map: L.Map;
  markerRef: React.RefObject<L.Marker | null>;
  polygons: { id: string; titel: string; geom: GJPolygon }[];
  kreise: { id: string; titel: string; lat: number; lon: number; radius_m: number }[];
}) {
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [imBereich, setImBereich] = useState<string[]>([]);

  async function suche() {
    const query = q.trim();
    if (!query) return;
    setPending(true);
    setInfo(null);
    setImBereich([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        query,
      )}&accept-language=de`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "de" },
      });
      const data = (await res.json()) as GeocodeTreffer[];
      const treffer = data?.[0];
      if (!treffer) {
        setInfo("Adresse nicht gefunden.");
        return;
      }
      const lat = Number(treffer.lat);
      const lon = Number(treffer.lon);
      if (markerRef.current) {
        markerRef.current.remove();
      }
      const marker = L.marker([lat, lon]).addTo(map);
      marker.bindPopup(treffer.display_name).openPopup();
      markerRef.current = marker;
      map.setView([lat, lon], 15);

      const treffend: string[] = [];

      const pt = turfPoint([lon, lat]);
      for (const p of polygons) {
        try {
          const pg = turfPolygon(
            (p.geom as GJPolygon).coordinates as number[][][],
          );
          if (booleanPointInPolygon(pt, pg)) treffend.push(p.titel);
        } catch {
          // fehlerhafte Geometrie überspringen
        }
      }

      const punktLatLng = L.latLng(lat, lon);
      for (const k of kreise) {
        const dist = punktLatLng.distanceTo(L.latLng(k.lat, k.lon));
        if (dist <= k.radius_m) treffend.push(k.titel);
      }

      const bereicheVorhanden = polygons.length + kreise.length > 0;
      if (treffend.length > 0) {
        setInfo(`Adresse liegt im Bereich: ${treffend.join(", ")}`);
        setImBereich(treffend);
      } else if (bereicheVorhanden) {
        setInfo("Adresse liegt außerhalb der eingezeichneten Bereiche.");
      } else {
        setInfo(`Adresse gefunden: ${treffer.display_name}`);
      }
    } catch (err) {
      setInfo(
        `Fehler bei der Adresssuche: ${err instanceof Error ? err.message : "unbekannt"}`,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="absolute right-3 top-3 z-[1000] w-72 rounded-md border bg-white shadow-md p-3">
      <Label htmlFor="adresse" className="text-xs">
        Adresse prüfen
      </Label>
      <div className="mt-1 flex gap-2">
        <Input
          id="adresse"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              suche();
            }
          }}
          placeholder="z. B. Hauptstraße 1, Musterstadt"
          className="h-9"
        />
        <Button size="sm" onClick={suche} disabled={pending}>
          {pending ? "…" : "Prüfen"}
        </Button>
      </div>
      {info && (
        <p
          className={`mt-2 text-xs ${
            imBereich.length > 0 ? "text-red-700 font-medium" : "text-stone-700"
          }`}
        >
          {info}
        </p>
      )}
    </div>
  );
}

function FarbAuswahl({
  wert,
  onChange,
}: {
  wert: KartenFarbe;
  onChange: (f: KartenFarbe) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {KARTEN_FARBEN.map((f) => {
        const aktiv = wert === f;
        return (
          <button
            key={f}
            type="button"
            aria-label={FARBE_LABEL[f]}
            title={FARBE_LABEL[f]}
            onClick={() => onChange(f)}
            className={`h-7 w-7 rounded-full ${FARBE_BG[f]} ring-offset-2 transition ${
              aktiv ? "ring-2 ring-stone-900" : "ring-1 ring-stone-300"
            }`}
          />
        );
      })}
    </div>
  );
}

function SpeichernDialog({
  offen,
  info,
  abbrechen,
  nachSpeichern,
}: {
  offen: boolean;
  info: NeueGeometrie | null;
  abbrechen: () => void;
  nachSpeichern: () => void;
}) {
  return (
    <Dialog open={offen} onOpenChange={(o) => !o && abbrechen()}>
      <DialogContent className="max-w-md">
        {offen && info && (
          <SpeichernDialogInhalt
            info={info}
            abbrechen={abbrechen}
            nachSpeichern={nachSpeichern}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SpeichernDialogInhalt({
  info,
  abbrechen,
  nachSpeichern,
}: {
  info: NeueGeometrie;
  abbrechen: () => void;
  nachSpeichern: () => void;
}) {
  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [farbe, setFarbe] = useState<KartenFarbe>(defaultFarbe(info.typ));
  const [pending, setPending] = useState(false);

  const router = useRouter();

  async function speichern() {
    setPending(true);
    try {
      const r = await speichereKartenobjekt({
        typ: info.typ,
        geometry: info.geometry,
        radius_m: info.radius_m,
        titel,
        beschreibung,
        farbe,
      });
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
        nachSpeichern();
      } else {
        toast.error(r.message);
      }
    } catch (err) {
      logger.error("speichern (client) failed:", err);
      toast.error(
        `Fehler beim Speichern: ${err instanceof Error ? err.message : "unbekannt"}`,
      );
    } finally {
      setPending(false);
    }
  }

  const titelText =
    info.typ === "polygon"
      ? "Neues Polygon speichern"
      : info.typ === "linie"
        ? "Neue Linie speichern"
        : info.typ === "kreis"
          ? "Neuen Kreis speichern"
          : "Neuen Punkt speichern";

  const platzhalter =
    info.typ === "polygon"
      ? "z. B. Sperrgebiet Bombenfund"
      : info.typ === "linie"
        ? "z. B. Straßensperre B16"
        : info.typ === "kreis"
          ? "z. B. Evakuierungsradius Bombe"
          : "z. B. Sammelpunkt Sporthalle";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{titelText}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="titel">Titel</Label>
          <Input
            id="titel"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder={platzhalter}
          />
        </div>
        {info.typ === "kreis" && info.radius_m && (
          <div className="rounded-md border bg-stone-50 p-2 text-xs text-stone-700">
            Radius: {formatRadius(info.radius_m)}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label>Farbe</Label>
          <FarbAuswahl wert={farbe} onChange={setFarbe} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="beschreibung">Beschreibung (optional)</Label>
          <Textarea
            id="beschreibung"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={abbrechen}>
          Abbrechen
        </Button>
        <Button onClick={speichern} disabled={pending || !titel.trim()}>
          {pending ? "Speichere …" : "Speichern"}
        </Button>
      </DialogFooter>
    </>
  );
}

function BearbeitenDialog({
  objekt,
  onClose,
}: {
  objekt: Kartenobjekt | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={objekt !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {objekt && (
          <BearbeitenDialogInhalt
            key={objekt.id}
            objekt={objekt}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BearbeitenDialogInhalt({
  objekt,
  onClose,
}: {
  objekt: Kartenobjekt;
  onClose: () => void;
}) {
  const router = useRouter();
  const [titel, setTitel] = useState(objekt.titel);
  const [beschreibung, setBeschreibung] = useState(objekt.beschreibung ?? "");
  const [farbe, setFarbe] = useState<KartenFarbe>(objekt.farbe);
  const [pending, setPending] = useState(false);

  async function speichern() {
    setPending(true);
    try {
      const r = await aktualisiereKartenobjekt({
        id: objekt.id,
        titel,
        beschreibung,
        farbe,
      });
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
        onClose();
      } else {
        toast.error(r.message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{labelFuerTyp(objekt.typ)} bearbeiten</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-titel">Titel</Label>
          <Input
            id="edit-titel"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Farbe</Label>
          <FarbAuswahl wert={farbe} onChange={setFarbe} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-beschreibung">Beschreibung (optional)</Label>
          <Textarea
            id="edit-beschreibung"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Abbrechen
        </Button>
        <Button onClick={speichern} disabled={pending || !titel.trim()}>
          {pending ? "Speichere …" : "Speichern"}
        </Button>
      </DialogFooter>
    </>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
