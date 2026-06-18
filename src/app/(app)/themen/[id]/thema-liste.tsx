"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FAQDetailDialog } from "@/components/faq-detail-dialog";
import type { FAQ } from "@/lib/types";

export function ThemaListe({ faqs }: { faqs: FAQ[] }) {
  const [selected, setSelected] = useState<FAQ | null>(null);

  if (faqs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Einträge in dieser Kategorie.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {faqs.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelected(f)}
            className="block w-full text-left"
          >
            <Card className="hover:border-stone-400 transition-colors">
              <CardContent className="p-4">
                <h2 className="font-medium">{f.frage}</h2>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {f.antwort}
                </p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <FAQDetailDialog
        faq={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </>
  );
}
