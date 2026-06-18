"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  erstelleFAQ,
  aktualisiereFAQ,
  loescheFAQ,
  type FAQActionState,
} from "./actions";
import type { FAQ, Kategorie } from "@/lib/types";

export function FAQEditorDialog({
  faq,
  kategorien,
  open,
  onOpenChange,
}: {
  faq: FAQ | null;
  kategorien: Kategorie[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open && (
          <FAQEditorInhalt
            key={faq?.id ?? "neu"}
            faq={faq}
            kategorien={kategorien}
            onSchliessen={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FAQEditorInhalt({
  faq,
  kategorien,
  onSchliessen,
}: {
  faq: FAQ | null;
  kategorien: Kategorie[];
  onSchliessen: () => void;
}) {
  const istNeu = !faq;
  const [frage, setFrage] = useState(faq?.frage ?? "");
  const [antwort, setAntwort] = useState(faq?.antwort ?? "");
  const [kategorieId, setKategorieId] = useState<string>(
    faq?.kategorie_id ?? "",
  );
  const [interneNotiz, setInterneNotiz] = useState(faq?.interne_notiz ?? "");
  const [sichtbar, setSichtbar] = useState<boolean>(faq?.sichtbar ?? true);
  const [pending, setPending] = useState(false);

  async function speichern() {
    setPending(true);
    const eingabe = {
      frage,
      antwort,
      kategorie_id: kategorieId || null,
      interne_notiz: interneNotiz || null,
      sichtbar,
    };
    let result: FAQActionState;
    if (istNeu) {
      result = await erstelleFAQ(eingabe);
    } else {
      result = await aktualisiereFAQ(faq!.id, eingabe);
    }
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      onSchliessen();
    } else {
      toast.error(result.message);
    }
  }

  async function loeschen() {
    if (!faq) return;
    if (!confirm(`FAQ wirklich löschen?\n\n${faq.frage}`)) return;
    setPending(true);
    const r = await loescheFAQ(faq.id);
    setPending(false);
    if (r.ok) {
      toast.success(r.message);
      onSchliessen();
    } else {
      toast.error(r.message);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {istNeu ? "Neue FAQ anlegen" : "FAQ bearbeiten"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="faq-frage">Frage</Label>
          <Input
            id="faq-frage"
            value={frage}
            onChange={(e) => setFrage(e.target.value)}
            placeholder="z. B. Wo ist die nächste Notunterkunft?"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="faq-antwort">Antwort</Label>
          <Textarea
            id="faq-antwort"
            value={antwort}
            onChange={(e) => setAntwort(e.target.value)}
            rows={6}
            placeholder="Verständlich, knapp, in vollständigen Sätzen."
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="faq-kategorie">Kategorie</Label>
          <select
            id="faq-kategorie"
            value={kategorieId}
            onChange={(e) => setKategorieId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— ohne Kategorie —</option>
            {kategorien.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="faq-notiz">Interne Notiz (optional)</Label>
          <Textarea
            id="faq-notiz"
            value={interneNotiz}
            onChange={(e) => setInterneNotiz(e.target.value)}
            rows={3}
            placeholder="Nur für interne Nutzung sichtbar — z. B. Quelle, Stand, offene Punkte."
          />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="faq-sichtbar" className="cursor-pointer">
              Für Bürger und Telefonist:innen sichtbar
            </Label>
            <p className="text-xs text-muted-foreground">
              {sichtbar
                ? "Erscheint im Telefonisten-FAQ und auf der öffentlichen Info-Seite."
                : "Nur die Leitung sieht diese FAQ — Telefonist:innen und Bürger nicht."}
            </p>
          </div>
          <button
            id="faq-sichtbar"
            type="button"
            role="switch"
            aria-checked={sichtbar}
            onClick={() => setSichtbar((v) => !v)}
            className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors ${
              sichtbar ? "bg-emerald-600" : "bg-stone-300"
            }`}
            title={
              sichtbar
                ? "Sichtbar — klicken zum Verstecken"
                : "Versteckt — klicken zum Freischalten"
            }
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                sichtbar ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
      <DialogFooter className="sm:justify-between">
        {!istNeu && (
          <Button
            variant="outline"
            onClick={loeschen}
            disabled={pending}
            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Löschen
          </Button>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:ml-auto">
          <Button variant="outline" onClick={onSchliessen} disabled={pending}>
            Abbrechen
          </Button>
          <Button
            onClick={speichern}
            disabled={pending || !frage.trim() || !antwort.trim()}
          >
            {pending ? "Speichere …" : istNeu ? "Anlegen" : "Speichern"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
