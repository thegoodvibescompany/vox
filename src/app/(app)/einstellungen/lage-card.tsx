"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  starteLage,
  beendeLage,
  aktualisiereAktiveLage,
  type EinstellungenState,
} from "./actions";
import { formatDeDatumZeit } from "@/lib/lage-utils";
import { KartenFokusInput, type KartenFokus } from "@/components/karten-fokus-input";
import { type Lage, type LageVorlage } from "@/lib/types";
import { toast } from "sonner";

export function LageCard({
  aktiveLage,
  vorlagen,
}: {
  aktiveLage: Lage | null;
  vorlagen: LageVorlage[];
}) {
  return aktiveLage ? (
    <AktiveLageBearbeiten lage={aktiveLage} />
  ) : (
    <NeueLageStarten vorlagen={vorlagen} />
  );
}

/**
 * Wie lange läuft die Lage schon? Nur grobe Granularität (Tage/Stunden/
 * Minuten), damit die Angabe ruhig bleibt. Greift auf Date.now() zu; das ist
 * zeitzonenunabhängig, Server- und Client-Wert sind also praktisch gleich. Den
 * seltenen Grenzfall (Minutenwechsel genau während der Hydration) fängt
 * suppressHydrationWarning am Ausgabe-Element ab.
 */
function dauerSeit(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return null;
  const tage = Math.floor(ms / 86_400_000);
  const stunden = Math.floor((ms % 86_400_000) / 3_600_000);
  const minuten = Math.floor((ms % 3_600_000) / 60_000);
  if (tage > 0) return `${tage} ${tage === 1 ? "Tag" : "Tagen"}`;
  if (stunden > 0) return `${stunden} ${stunden === 1 ? "Stunde" : "Stunden"}`;
  if (minuten > 0) return `${minuten} ${minuten === 1 ? "Minute" : "Minuten"}`;
  return "wenigen Sekunden";
}

/** Gleicher Fokus? Maßgeblich sind die Koordinaten, nicht der Anzeigename. */
function fokusGleich(a: KartenFokus | null, b: KartenFokus | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6;
}

function AktiveLageBearbeiten({ lage }: { lage: Lage }) {
  const initialFokus: KartenFokus | null =
    lage.map_focus_city &&
    lage.map_center_lat !== null &&
    lage.map_center_lon !== null
      ? {
          city: lage.map_focus_city,
          lat: lage.map_center_lat,
          lon: lage.map_center_lon,
        }
      : null;

  const [name, setName] = useState(lage.name);
  const [fokus, setFokus] = useState<KartenFokus | null>(initialFokus);
  const [speicherPending, startSpeichern] = useTransition();
  const [beendenPending, startBeenden] = useTransition();

  const dauer = dauerSeit(lage.gestartet_at);
  const pending = speicherPending || beendenPending;
  const geaendert =
    name.trim() !== lage.name || !fokusGleich(fokus, initialFokus);

  function speichern() {
    startSpeichern(async () => {
      const r = await aktualisiereAktiveLage({
        name: name.trim(),
        karten_fokus_raw: fokus ? JSON.stringify(fokus) : null,
      });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });
  }

  function beenden() {
    if (!confirm("Aktive Lage wirklich beenden?")) return;
    startBeenden(async () => {
      const r = await beendeLage();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });
  }

  return (
    <div className="space-y-6">
      {/* Status + Beenden in einer Kachel */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-sm font-semibold text-stone-900">
                Aktiv
              </span>
              <span className="text-stone-300" aria-hidden="true">
                ·
              </span>
              <span className="text-sm font-medium text-stone-700">
                {lage.name}
              </span>
            </div>
            <p
              className="mt-2 text-xs text-muted-foreground"
              suppressHydrationWarning
            >
              Gestartet am {formatDeDatumZeit(lage.gestartet_at)}
              {dauer ? ` · läuft seit ${dauer}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={beenden}
            disabled={pending}
          >
            {beendenPending ? "Beende …" : "Lage beenden"}
          </Button>
        </div>
      </div>

      {/* Einstellungen der laufenden Lage */}
      <div className="space-y-4 rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="aktiv-name">Name der Lage</Label>
          <Input
            id="aktiv-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
          />
        </div>
        <KartenFokusInput
          name="karten_fokus"
          initial={initialFokus}
          onChange={setFokus}
        />
        {geaendert && (
          <Button type="button" onClick={speichern} disabled={pending}>
            {speicherPending ? "Speichere …" : "Aktualisieren"}
          </Button>
        )}
      </div>
    </div>
  );
}

function NeueLageStarten({ vorlagen }: { vorlagen: LageVorlage[] }) {
  const [state, action, pending] = useActionState<
    EinstellungenState | undefined,
    FormData
  >(starteLage, undefined);
  const [vorlageId, setVorlageId] = useState("");
  // Leerer Wert (Default) = ohne Vorlage starten. Nur eine aktiv gewaehlte
  // echte Vorlage liefert Kategorien und Standard-FAQs.
  const istLeer = vorlageId === "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Neue Lage starten</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="vorlage_id">Vorlage</Label>
            <select
              id="vorlage_id"
              name="vorlage_id"
              value={vorlageId}
              onChange={(e) => setVorlageId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Ohne Vorlage</option>
              {vorlagen.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {istLeer
                ? "Startet ohne Kategorien und FAQs."
                : "Übernimmt Kategorien und Standard-FAQs der Vorlage; die FAQs sind nach dem Start zunächst versteckt."}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name der Lage</Label>
            <Input
              id="name"
              name="name"
              placeholder="z. B. Hochwasser Donau Mai 2026"
            />
          </div>
          <KartenFokusInput name="karten_fokus" initial={null} />
          {state && (
            <p
              className={`text-sm ${
                state.ok ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Starte …" : "Lage starten"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
