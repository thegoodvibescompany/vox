"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FAQDetailDialog } from "./faq-detail-dialog";
import { useAutoRefresh } from "@/lib/use-auto-refresh";
import type { FAQ, Kategorie } from "@/lib/types";

export function StartseiteClient({
  faqs,
  kategorien,
}: {
  faqs: FAQ[];
  kategorien: Kategorie[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FAQ | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Polling: neue/aktualisierte FAQs werden ohne manuellen Reload sichtbar.
  useAutoRefresh();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const kategorieById = useMemo(() => {
    const map = new Map<string, Kategorie>();
    for (const k of kategorien) map.set(k.id, k);
    return map;
  }, [kategorien]);

  const zuletzt = useMemo(() => faqs.slice(0, 3), [faqs]);

  // Häufig gestellte Fragen: Top 3 nach klick_zaehler, aber nur FAQs mit
  // mindestens einem Klick — sonst hätten wir nur "zufällige" Reihenfolge.
  const haeufig = useMemo(
    () =>
      faqs
        .filter((f) => f.klick_zaehler > 0)
        .slice()
        .sort((a, b) => b.klick_zaehler - a.klick_zaehler)
        .slice(0, 3),
    [faqs],
  );

  const kategorienMitInhalt = useMemo(() => {
    const zaehler = new Map<string, number>();
    for (const f of faqs) {
      if (!f.kategorie_id) continue;
      zaehler.set(f.kategorie_id, (zaehler.get(f.kategorie_id) ?? 0) + 1);
    }
    return kategorien
      .map((k) => ({ kategorie: k, anzahl: zaehler.get(k.id) ?? 0 }))
      .filter((e) => e.anzahl > 0);
  }, [faqs, kategorien]);

  const treffer = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as FAQ[];
    return faqs
      .filter(
        (f) =>
          f.frage.toLowerCase().includes(q) ||
          f.antwort.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [faqs, query]);

  const showSuche = query.trim().length > 0;
  const offen = selected !== null;

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="space-y-2">
        <label htmlFor="faq-suche" className="text-sm font-medium">
          FAQ-Suche
        </label>
        <Input
          id="faq-suche"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tippe ein Stichwort, z. B. Trinkwasser, Notunterkunft, Sperrung …"
          className="h-12 text-base"
        />
      </div>

      {showSuche ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            {treffer.length === 0
              ? "Keine Treffer."
              : `${treffer.length} Treffer`}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {treffer.map((f) => (
              <FAQKachel
                key={f.id}
                faq={f}
                kategorie={
                  f.kategorie_id ? kategorieById.get(f.kategorie_id) ?? null : null
                }
                onSelect={() => setSelected(f)}
              />
            ))}
          </div>
        </section>
      ) : (
        <>
          {haeufig.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Häufig gestellte Fragen
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {haeufig.map((f) => (
                  <FAQKachel
                    key={f.id}
                    faq={f}
                    kategorie={
                      f.kategorie_id
                        ? kategorieById.get(f.kategorie_id) ?? null
                        : null
                    }
                    onSelect={() => setSelected(f)}
                  />
                ))}
              </div>
            </section>
          )}

          {zuletzt.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Zuletzt veröffentlicht
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {zuletzt.map((f) => (
                  <FAQKachel
                    key={f.id}
                    faq={f}
                    kategorie={
                      f.kategorie_id
                        ? kategorieById.get(f.kategorie_id) ?? null
                        : null
                    }
                    onSelect={() => setSelected(f)}
                  />
                ))}
              </div>
            </section>
          )}

          {kategorienMitInhalt.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Themen
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {kategorienMitInhalt.map(({ kategorie: k, anzahl }) => (
                  <a
                    key={k.id}
                    href={`/themen/${k.id}`}
                    className="block rounded-lg border bg-white p-4 hover:bg-stone-50 transition-colors"
                  >
                    <div className="font-medium">{k.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {anzahl} {anzahl === 1 ? "Eintrag" : "Einträge"}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <FAQDetailDialog
        faq={selected}
        open={offen}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </main>
  );
}

function FAQKachel({
  faq,
  kategorie,
  onSelect,
}: {
  faq: FAQ;
  kategorie: Kategorie | null;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="text-left"
      type="button"
    >
      <Card className="hover:border-stone-400 transition-colors h-full">
        <CardContent className="p-4">
          {kategorie && (
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {kategorie.name}
            </div>
          )}
          <div className="font-medium leading-snug">{faq.frage}</div>
          <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {faq.antwort}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
