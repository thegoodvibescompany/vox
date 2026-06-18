"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, X, BookOpen, MessagesSquare } from "lucide-react";
import { formatDeDatumZeit } from "@/lib/lage-utils";
import { useAutoRefresh } from "@/lib/use-auto-refresh";
import {
  markiereAnfrageGesehen,
  markiereFaqGelesen,
} from "@/app/(app)/freigaben-actions";

// quelle = woher der Eintrag stammt; bestimmt, welche Mark-as-read-Action
// beim Klick aufgerufen wird. Bürgerfragen-Einträge bekommt nur die Leitung
// (anfrage.freigeben), FAQ-Einträge nur Wissens-Nutzer — s. (app)/layout.tsx.
type PosteingangQuelle = "buergerfrage" | "faq";

export type PosteingangEintrag = {
  id: string;
  quelle: PosteingangQuelle;
  titel: string;
  vorschau: string | null;
  datum: string | null;
  href: string;
};

const LABEL = "Posteingang";

export function Posteingang({
  eintraege,
}: {
  eintraege: PosteingangEintrag[];
}) {
  const [offen, setOffen] = useState(false);

  // Hält Zähler/Liste aktuell: neue Bürgerfragen und FAQs erscheinen ohne
  // manuellen Reload (serverseitiges Polling, kein Browser-WebSocket).
  useAutoRefresh();

  useEffect(() => {
    if (!offen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOffen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offen]);

  useEffect(() => {
    if (!offen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [offen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        aria-label={LABEL}
        title={LABEL}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-stone-100 text-stone-700"
      >
        <Inbox className="w-5 h-5" />
        {eintraege.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-stone-800 text-white text-[10px] font-medium flex items-center justify-center px-1">
            {eintraege.length}
          </span>
        )}
      </button>

      <div
        className={`fixed inset-0 z-50 ${offen ? "" : "pointer-events-none"}`}
        aria-hidden={!offen}
      >
        <div
          onClick={() => setOffen(false)}
          className={`absolute inset-0 bg-black/30 transition-opacity ${
            offen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          role="dialog"
          aria-label={LABEL}
          className={`absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl border-l flex flex-col transition-transform duration-200 ${
            offen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">{LABEL}</h2>
            <button
              type="button"
              onClick={() => setOffen(false)}
              aria-label="Schließen"
              title="Schließen"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-stone-100 text-stone-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {eintraege.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aktuell keine neuen Eingänge.
              </p>
            ) : (
              <ul className="space-y-3">
                {eintraege.map((e) => (
                  <li key={e.id}>
                    <PosteingangKarte
                      eintrag={e}
                      onGeoeffnet={() => setOffen(false)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function PosteingangKarte({
  eintrag,
  onGeoeffnet,
}: {
  eintrag: PosteingangEintrag;
  onGeoeffnet: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function markiereGelesen() {
    if (eintrag.quelle === "faq") {
      await markiereFaqGelesen(eintrag.id);
    } else {
      await markiereAnfrageGesehen(eintrag.id);
    }
  }

  function handleKlick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    onGeoeffnet();
    startTransition(async () => {
      await markiereGelesen();
      router.push(eintrag.href);
    });
  }

  function handleAlsGelesen(e: React.MouseEvent<HTMLButtonElement>) {
    // Verhindern, dass der Klick die Link-Navigation auslöst.
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await markiereGelesen();
      router.refresh();
    });
  }

  const istFaq = eintrag.quelle === "faq";

  return (
    <div className="relative">
      <Link
        href={eintrag.href}
        onClick={handleKlick}
        aria-disabled={pending}
        className={`block rounded-md border bg-white p-3 pr-9 text-sm hover:bg-stone-50 transition-colors ${
          pending ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground mb-1">
          {istFaq ? (
            <>
              <BookOpen className="w-3 h-3" />
              <span>Neue FAQ</span>
            </>
          ) : (
            <>
              <MessagesSquare className="w-3 h-3" />
              <span>Bürgeranfrage</span>
            </>
          )}
        </div>
        <p className="font-medium leading-snug whitespace-pre-wrap">
          {eintrag.titel}
        </p>
        {eintrag.vorschau && (
          <p className="mt-2 text-stone-700 leading-relaxed whitespace-pre-wrap line-clamp-3">
            {eintrag.vorschau}
          </p>
        )}
        {eintrag.datum && (
          <div className="mt-2 text-xs text-muted-foreground">
            {formatDeDatumZeit(eintrag.datum)}
          </div>
        )}
      </Link>
      <button
        type="button"
        onClick={handleAlsGelesen}
        disabled={pending}
        aria-label="Als gelesen markieren"
        title="Als gelesen markieren"
        className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-7 h-7 rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-800 transition-colors disabled:opacity-50"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
