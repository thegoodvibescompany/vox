"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  HILFE_KATEGORIEN,
  type HilfeArtikel,
  type HilfeKategorie,
} from "@/lib/hilfe-inhalte";
import type { Permission } from "@/lib/types";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Suchbegriff im Text gelb markieren (case-insensitiv, alle Tokens). */
function Hervorgehoben({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>;
  const regex = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const teile = text.split(regex);
  return (
    <>
      {teile.map((t, i) =>
        tokens.some((tok) => t.toLowerCase() === tok.toLowerCase()) ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5">
            {t}
          </mark>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
    </>
  );
}

/** Alle durchsuchbaren Texte eines Artikels, kleingeschrieben. */
function suchtext(a: HilfeArtikel): string {
  return [
    a.titel,
    ...a.stichworte,
    ...a.absaetze,
    ...(a.schritte ?? []),
    a.hinweis ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function HilfeClient({
  permissions,
  istPlattformAdmin,
  rolleName,
}: {
  permissions: Permission[];
  istPlattformAdmin: boolean;
  rolleName: string | null;
}) {
  const [query, setQuery] = useState("");
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Wie auf der Übersicht: sofort lostippen können.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Rechte-Filter: jede Rolle sieht nur Artikel zu Funktionen, die sie
  // nutzen kann. Der Plattform-Admin sieht zusätzlich die Plattform-Artikel.
  const sichtbareKategorien = useMemo<HilfeKategorie[]>(
    () =>
      HILFE_KATEGORIEN.map((k) => ({
        ...k,
        artikel: k.artikel.filter((a) => {
          if (a.nurPlattformAdmin) return istPlattformAdmin;
          if (a.recht) return permissions.includes(a.recht);
          return true;
        }),
      })).filter((k) => k.artikel.length > 0),
    [permissions, istPlattformAdmin],
  );

  const tokens = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );
  const sucheAktiv = tokens.length > 0;

  // Treffer: Artikel, in dem ALLE Suchwörter vorkommen (Titel, Stichworte
  // oder Text). Bei aktiver Suche werden Treffer aufgeklappt angezeigt.
  const gefiltert = useMemo<HilfeKategorie[]>(() => {
    if (!sucheAktiv) return sichtbareKategorien;
    return sichtbareKategorien
      .map((k) => ({
        ...k,
        artikel: k.artikel.filter((a) => {
          const text = suchtext(a);
          return tokens.every((t) => text.includes(t));
        }),
      }))
      .filter((k) => k.artikel.length > 0);
  }, [sichtbareKategorien, tokens, sucheAktiv]);

  const trefferAnzahl = useMemo(
    () => gefiltert.reduce((n, k) => n + k.artikel.length, 0),
    [gefiltert],
  );

  function toggle(id: string) {
    setOffen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-semibold">Hilfe: Wie funktioniert VOX?</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Diese Hilfe zeigt nur Funktionen, die deine Rolle
        {rolleName ? ` (${rolleName})` : ""} nutzen kann.
      </p>

      <div className="mt-6 space-y-2">
        <label htmlFor="hilfe-suche" className="text-sm font-medium">
          Stichwortsuche
        </label>
        <Input
          id="hilfe-suche"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="z. B. Fachstelle, Karte, Freigabe, Anmeldung …"
          autoComplete="off"
        />
        {sucheAktiv && (
          <p className="text-sm text-muted-foreground">
            {trefferAnzahl === 0
              ? "Keine Artikel gefunden. Versuch ein anderes Stichwort."
              : trefferAnzahl === 1
                ? "1 Artikel gefunden."
                : `${trefferAnzahl} Artikel gefunden.`}
          </p>
        )}
      </div>

      <div className="mt-8 space-y-10">
        {gefiltert.map((kategorie) => (
          <section key={kategorie.id} className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
              {kategorie.titel}
            </h2>
            <div className="divide-y rounded-lg border bg-white">
              {kategorie.artikel.map((artikel) => {
                const istOffen = sucheAktiv || offen.has(artikel.id);
                return (
                  <article
                    key={artikel.id}
                    id={`hilfe-${artikel.id}`}
                    className="scroll-mt-20"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(artikel.id)}
                      aria-expanded={istOffen}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50"
                    >
                      <span className="font-medium">
                        <Hervorgehoben text={artikel.titel} tokens={tokens} />
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${
                          istOffen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {istOffen && (
                      <div className="space-y-3 px-4 pb-4 text-sm leading-relaxed text-stone-700">
                        {artikel.absaetze.map((absatz, i) => (
                          <p key={i}>
                            <Hervorgehoben text={absatz} tokens={tokens} />
                          </p>
                        ))}
                        {artikel.schritte && (
                          <ol className="list-decimal space-y-1 pl-5">
                            {artikel.schritte.map((schritt, i) => (
                              <li key={i}>
                                <Hervorgehoben text={schritt} tokens={tokens} />
                              </li>
                            ))}
                          </ol>
                        )}
                        {artikel.hinweis && (
                          <div className="rounded-md border bg-stone-50 px-3 py-2 text-stone-700">
                            <span className="font-medium">Hinweis: </span>
                            <Hervorgehoben
                              text={artikel.hinweis}
                              tokens={tokens}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
