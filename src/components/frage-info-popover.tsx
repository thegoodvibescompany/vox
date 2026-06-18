"use client";

import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDeDatumZeit } from "@/lib/lage-utils";
import type { Buergerfrage, Profile } from "@/lib/types";

type ProfileMini = Pick<Profile, "id" | "name" | "email">;

export function FrageInfoPopover({
  frage,
  erfasstVon,
  freigegebenVon,
}: {
  frage: Buergerfrage;
  erfasstVon: ProfileMini | undefined;
  freigegebenVon: ProfileMini | undefined;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Details zur Anfrage"
            title="Details zur Anfrage"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-700"
          >
            <Info className="w-4 h-4" />
          </button>
        }
      />
      <PopoverContent align="end" className="w-80 text-sm">
        <h3 className="text-sm font-semibold mb-2">Verlauf</h3>
        <dl className="space-y-2 text-xs">
          <Eintrag
            label="Erfasst von"
            wert={
              erfasstVon
                ? `${erfasstVon.name || erfasstVon.email} · ${formatDeDatumZeit(frage.erfasst_at)}`
                : formatDeDatumZeit(frage.erfasst_at)
            }
          />
          <Eintrag
            label="An Fachstelle gesendet"
            wert={frage.fachstelle_email ?? "—"}
          />
          {frage.antwort_at && (
            <Eintrag
              label="Antwort eingegangen"
              wert={`${
                [frage.antwort_von_name, frage.antwort_von_email]
                  .filter(Boolean)
                  .join(" · ") || "ohne Angabe"
              } · ${formatDeDatumZeit(frage.antwort_at)}`}
            />
          )}
          {frage.freigegeben_at && (
            <Eintrag
              label="Freigegeben"
              wert={
                freigegebenVon
                  ? `${freigegebenVon.name || freigegebenVon.email} · ${formatDeDatumZeit(frage.freigegeben_at)}`
                  : formatDeDatumZeit(frage.freigegeben_at)
              }
            />
          )}
          {frage.antwort_redaktion && (
            <Eintrag
              label="Antwort überarbeitet"
              wert="ja, durch die Leitung"
            />
          )}
          {frage.ins_faq_id && (
            <Eintrag label="Im FAQ" wert="übernommen" />
          )}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

function Eintrag({ label, wert }: { label: string; wert: string }) {
  return (
    <div>
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-stone-900 mt-0.5 break-words">{wert}</dd>
    </div>
  );
}
