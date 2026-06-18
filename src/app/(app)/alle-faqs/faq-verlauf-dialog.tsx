"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDeDatumZeit } from "@/lib/lage-utils";
import {
  ladeFaqVerlauf,
  type FaqVerlaufDaten,
  type FaqVerlaufVersion,
} from "./actions";
import type { FAQ } from "@/lib/types";

export function FAQVerlaufDialog({
  faq,
  open,
  onOpenChange,
}: {
  faq: FAQ | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Änderungsverlauf</DialogTitle>
        </DialogHeader>
        {open && faq ? <VerlaufInhalt key={faq.id} faqId={faq.id} /> : null}
      </DialogContent>
    </Dialog>
  );
}

// Ein einheitlich formatierter Eintrag der Timeline: oben die Aktion, dezent
// "von [Name]" und der Zeitpunkt, darunter optional der Inhalt der Änderung.
type VerlaufEintrag = {
  key: string;
  aktion: string;
  von: string | null;
  wann: string | null;
  inhalt: string | null;
};

function VerlaufInhalt({ faqId }: { faqId: string }) {
  const [daten, setDaten] = useState<FaqVerlaufDaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  // On-demand laden: Der Verlauf wird erst beim Öffnen geholt, nicht für
  // jede FAQ der Liste vorab. Cleanup-Flag gegen Race beim schnellen
  // Wechseln/Schließen — kein synchrones setState im Effect (ESLint-sauber).
  useEffect(() => {
    let abbruch = false;
    ladeFaqVerlauf(faqId).then((r) => {
      if (abbruch) return;
      if (r.ok) setDaten(r.verlauf);
      else setFehler(r.message);
    });
    return () => {
      abbruch = true;
    };
  }, [faqId]);

  if (fehler) {
    return <p className="py-6 text-center text-sm text-destructive">{fehler}</p>;
  }
  if (!daten) {
    return <VerlaufSkeleton />;
  }

  const eintraege = baueEintraege(daten);

  return (
    <div className="max-h-[60vh] overflow-y-auto pr-2">
      <ol className="relative space-y-5 py-1 pl-6">
        {/* Durchgehende Zeitstrahl-Linie hinter den Punkten. */}
        <span
          aria-hidden
          className="absolute top-2 bottom-2 left-[5px] w-px bg-stone-200"
        />
        {eintraege.map((e, i) => (
          <TimelineKnoten
            key={e.key}
            dotClass={i === 0 ? "bg-emerald-500" : "bg-stone-300"}
          >
            <Kopfzeile aktion={e.aktion} von={e.von} wann={e.wann} />
            {e.inhalt && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                {e.inhalt}
              </p>
            )}
          </TimelineKnoten>
        ))}
      </ol>
    </div>
  );
}

function Kopfzeile({
  aktion,
  von,
  wann,
}: {
  aktion: string;
  von: string | null;
  wann: string | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-sm font-medium">{aktion}</span>
      {von && (
        <span className="text-xs text-muted-foreground">von {von}</span>
      )}
      {wann && (
        <span className="text-xs text-muted-foreground">
          {formatDeDatumZeit(wann)}
        </span>
      )}
    </div>
  );
}

function TimelineKnoten({
  dotClass,
  children,
}: {
  dotClass: string;
  children: ReactNode;
}) {
  return (
    <li className="relative">
      <span
        aria-hidden
        className={`absolute top-1 -left-6 h-2.5 w-2.5 rounded-full ring-4 ring-white ${dotClass}`}
      />
      <div className="space-y-1">{children}</div>
    </li>
  );
}

// Wandelt die geladenen Daten in eine flache, einheitlich formatierte Liste:
// je geänderter Eigenschaft ein Eintrag (neueste zuerst), abgeschlossen vom
// Anker "FAQ angelegt". So hat jeder Knoten dasselbe Format wie die Anlage.
function baueEintraege(daten: FaqVerlaufDaten): VerlaufEintrag[] {
  const { aktuell, angelegt, versionen } = daten;
  const eintraege: VerlaufEintrag[] = [];

  versionen.forEach((v, i) => {
    const nachher = i === 0 ? aktuell : (versionen[i - 1] ?? aktuell);
    for (const a of berechneAenderungen(v, nachher)) {
      eintraege.push({
        key: `${v.version}-${a.label}`,
        aktion: a.label,
        von: v.geaendert_von_name,
        wann: v.geaendert_at,
        inhalt: a.inhalt,
      });
    }
  });

  eintraege.push({
    key: "angelegt",
    aktion: "FAQ angelegt",
    von: angelegt.von_name,
    wann: angelegt.at,
    inhalt: null,
  });

  return eintraege;
}

type Aenderung = { label: string; inhalt: string | null };

// Vergleicht eine frühere Fassung mit ihrer direkten Nachfolge-Fassung und
// liefert je geändertem Feld ein Label plus den NEUEN Inhalt (bei der Notiz
// differenziert nach hinzugefügt/geändert/entfernt).
function berechneAenderungen(
  vorher: FaqVerlaufVersion,
  nachher: { frage: string; antwort: string; interne_notiz: string | null },
): Aenderung[] {
  const a: Aenderung[] = [];
  if (vorher.frage !== nachher.frage) {
    a.push({ label: "Frage geändert", inhalt: nachher.frage });
  }
  if (vorher.antwort !== nachher.antwort) {
    a.push({ label: "Antwort geändert", inhalt: nachher.antwort });
  }
  const notizVorher = vorher.interne_notiz ?? "";
  const notizNachher = nachher.interne_notiz ?? "";
  if (notizVorher !== notizNachher) {
    if (notizVorher === "") {
      a.push({ label: "Notiz hinzugefügt", inhalt: notizNachher });
    } else if (notizNachher === "") {
      a.push({ label: "Notiz entfernt", inhalt: null });
    } else {
      a.push({ label: "Notiz geändert", inhalt: notizNachher });
    }
  }
  // Falls der Trigger ohne erkennbare Feldänderung ausgelöst hat, bleibt
  // wenigstens ein neutraler Eintrag erhalten.
  if (a.length === 0) {
    a.push({ label: "Bearbeitet", inhalt: null });
  }
  return a;
}

function VerlaufSkeleton() {
  return (
    <div className="space-y-5 py-2 pl-6">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-stone-200" />
          <div className="h-12 animate-pulse rounded-lg bg-stone-100" />
        </div>
      ))}
    </div>
  );
}
