"use client";

import { useMemo, useState } from "react";
import { EyeOff, History, MessageSquarePlus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FAQEditorDialog } from "./faq-editor-dialog";
import { FAQVerlaufDialog } from "./faq-verlauf-dialog";
import { FrageErfassenDialog } from "@/components/frage-erfassen-dialog";
import { useAutoRefresh } from "@/lib/use-auto-refresh";
import type { FAQ, Kategorie } from "@/lib/types";

export function FAQsListe({
  faqs,
  kategorien,
  darfBearbeiten,
}: {
  faqs: FAQ[];
  kategorien: Kategorie[];
  darfBearbeiten: boolean;
}) {
  const [editorOffen, setEditorOffen] = useState(false);
  const [bearbeitet, setBearbeitet] = useState<FAQ | null>(null);

  // Polling: FAQ-Liste aktualisiert sich, wenn jemand pflegt oder freigibt.
  useAutoRefresh();

  const gruppiert = useMemo(() => {
    const map = new Map<string, FAQ[]>();
    for (const k of kategorien) map.set(k.id, []);
    const ohneKat: FAQ[] = [];
    for (const f of faqs) {
      if (f.kategorie_id && map.has(f.kategorie_id)) {
        map.get(f.kategorie_id)!.push(f);
      } else {
        ohneKat.push(f);
      }
    }
    return { map, ohneKat };
  }, [faqs, kategorien]);

  function neueFAQ() {
    setBearbeitet(null);
    setEditorOffen(true);
  }

  function bearbeiteFAQ(f: FAQ) {
    setBearbeitet(f);
    setEditorOffen(true);
  }

  return (
    <>
      {darfBearbeiten && (
        <div className="mt-4 flex items-center justify-end">
          <Button onClick={neueFAQ}>Neue FAQ</Button>
        </div>
      )}

      <div className="mt-6 space-y-10">
        {kategorien.map((k) => {
          const items = gruppiert.map.get(k.id) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={k.id}>
              <h2 className="text-lg font-medium mb-3">{k.name}</h2>
              <div className="space-y-3">
                {items.map((f) => (
                  <FAQEintrag
                    key={f.id}
                    faq={f}
                    darfBearbeiten={darfBearbeiten}
                    onEdit={() => bearbeiteFAQ(f)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {gruppiert.ohneKat.length > 0 && (
          <section>
            <h2 className="text-lg font-medium mb-3">Ohne Kategorie</h2>
            <div className="space-y-3">
              {gruppiert.ohneKat.map((f) => (
                <FAQEintrag
                  key={f.id}
                  faq={f}
                  darfBearbeiten={darfBearbeiten}
                  onEdit={() => bearbeiteFAQ(f)}
                />
              ))}
            </div>
          </section>
        )}
        {faqs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Noch keine FAQs angelegt.
          </p>
        )}
      </div>

      <FAQEditorDialog
        faq={bearbeitet}
        kategorien={kategorien}
        open={editorOffen}
        onOpenChange={setEditorOffen}
      />
    </>
  );
}

function FAQEintrag({
  faq,
  darfBearbeiten,
  onEdit,
}: {
  faq: FAQ;
  darfBearbeiten: boolean;
  onEdit: () => void;
}) {
  const [verlaufOffen, setVerlaufOffen] = useState(false);
  const [rueckfrageOffen, setRueckfrageOffen] = useState(false);

  // Roter Balken rechts macht versteckte FAQs in der Liste sofort sichtbar.
  // relative + overflow-hidden, damit der Balken nicht über den Rand ragt.
  return (
    <>
      <Card
        id={`faq-${faq.id}`}
        className={`relative overflow-hidden scroll-mt-24 target:ring-2 target:ring-emerald-400 ${
          !faq.sichtbar ? "border-red-300 bg-red-50/30" : ""
        }`}
      >
        {!faq.sichtbar && (
          <span
            aria-hidden
            className="absolute inset-y-0 right-0 w-1.5 bg-red-500"
          />
        )}
        <CardContent className="p-4 pr-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-medium">{faq.frage}</h3>
            {!faq.sichtbar && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-300 text-red-800 text-[11px] font-medium px-2 py-0.5">
                <EyeOff className="w-3 h-3" /> Versteckt
              </span>
            )}
          </div>
          <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">
            {faq.antwort}
          </p>
          {faq.interne_notiz && (
            <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
              <span className="font-medium">Interne Notiz:</span>{" "}
              {faq.interne_notiz}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRueckfrageOffen(true)}
            >
              <MessageSquarePlus className="w-4 h-4 mr-1" />
              Rückfrage
            </Button>
            {darfBearbeiten && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onEdit}
                  aria-label="Bearbeiten"
                  title="Bearbeiten"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                {faq.version > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVerlaufOffen(true)}
                    aria-label="Änderungsverlauf"
                    title="Änderungsverlauf"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <FrageErfassenDialog
        bezugFaq={{ id: faq.id, frage: faq.frage, antwort: faq.antwort }}
        open={rueckfrageOffen}
        onOpenChange={setRueckfrageOffen}
      />

      {darfBearbeiten && faq.version > 1 && (
        <FAQVerlaufDialog
          faq={faq}
          open={verlaufOffen}
          onOpenChange={setVerlaufOffen}
        />
      )}
    </>
  );
}
