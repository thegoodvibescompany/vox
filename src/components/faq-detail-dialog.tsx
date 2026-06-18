"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDeDatumZeit } from "@/lib/lage-utils";
import { FrageErfassenDialog } from "./frage-erfassen-dialog";
import { inkrementiereFaqKlick } from "@/app/(app)/freigaben-actions";
import type { FAQ } from "@/lib/types";

export function FAQDetailDialog({
  faq,
  open,
  onOpenChange,
}: {
  faq: FAQ | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rueckfrageOffen, setRueckfrageOffen] = useState(false);

  // Klick-Telemetrie für das Ranking auf der Startseite.
  // Feuert einmal pro Öffnen — die faq.id-Abhängigkeit verhindert
  // Doppelzählung beim Re-Render desselben FAQs.
  const faqId = faq?.id;
  useEffect(() => {
    if (open && faqId) {
      void inkrementiereFaqKlick(faqId);
    }
  }, [open, faqId]);

  if (!faq) return null;
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{faq.frage}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="whitespace-pre-wrap leading-relaxed">
              {faq.antwort}
            </div>
            {faq.interne_notiz && (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm">
                <div className="font-medium text-sky-900 mb-1">
                  Interne Notiz
                </div>
                <div className="text-sky-900 whitespace-pre-wrap">
                  {faq.interne_notiz}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between sm:items-center">
            <Button
              variant="outline"
              onClick={() => setRueckfrageOffen(true)}
            >
              <MessageSquarePlus className="w-4 h-4" />
              Rückfrage zum FAQ stellen
            </Button>
            <div className="text-xs text-muted-foreground">
              Stand: {formatDeDatumZeit(faq.stand_at)}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FrageErfassenDialog
        bezugFaq={{ id: faq.id, frage: faq.frage, antwort: faq.antwort }}
        open={rueckfrageOffen}
        onOpenChange={setRueckfrageOffen}
      />
    </>
  );
}
