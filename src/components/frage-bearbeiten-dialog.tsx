"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  bearbeiteBuergerfrage,
  bearbeiteFreigegebeneBuergerfrage,
  bearbeiteUndFreigebenBuergerfrage,
  loescheBuergerfrage,
} from "@/app/(app)/dashboard/actions";
import type { Buergerfrage, FrageStatus, Kategorie } from "@/lib/types";

export function FrageBearbeitenDialog({
  frage,
  kategorien,
  open,
  onOpenChange,
}: {
  frage: Buergerfrage | null;
  kategorien: Kategorie[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mitAntwort =
    frage?.status === "antwort_eingegangen" || frage?.status === "freigegeben";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={mitAntwort ? "max-w-2xl" : "max-w-lg"}>
        {open && frage && (
          <FrageBearbeitenInhalt
            key={frage.id}
            frage={frage}
            kategorien={kategorien}
            onSchliessen={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FrageBearbeitenInhalt({
  frage,
  kategorien,
  onSchliessen,
}: {
  frage: Buergerfrage;
  kategorien: Kategorie[];
  onSchliessen: () => void;
}) {
  const status = frage.status as FrageStatus;
  const mitAntwort = status === "antwort_eingegangen" || status === "freigegeben";

  const [text, setText] = useState(frage.frage_text);
  const [kategorieId, setKategorieId] = useState(frage.kategorie_id ?? "");
  const [redaktion, setRedaktion] = useState(
    frage.antwort_redaktion ?? frage.antwort_text ?? "",
  );
  const [pending, setPending] = useState(false);
  const [loeschPending, startLoeschen] = useTransition();

  async function speichern() {
    setPending(true);
    let r;
    if (status === "antwort_eingegangen") {
      r = await bearbeiteUndFreigebenBuergerfrage({
        id: frage.id,
        frage_text: text,
        kategorie_id: kategorieId || null,
        redaktion,
      });
    } else if (status === "freigegeben") {
      r = await bearbeiteFreigegebeneBuergerfrage({
        id: frage.id,
        frage_text: text,
        kategorie_id: kategorieId || null,
        redaktion,
      });
    } else {
      r = await bearbeiteBuergerfrage({
        id: frage.id,
        frage_text: text,
        kategorie_id: kategorieId || null,
      });
    }
    setPending(false);
    if (r.ok) {
      toast.success(r.message);
      onSchliessen();
    } else toast.error(r.message);
  }

  function loeschen() {
    if (!confirm("Bürgerfrage wirklich löschen? Das lässt sich nicht rückgängig machen.")) {
      return;
    }
    const fd = new FormData();
    fd.set("id", frage.id);
    startLoeschen(async () => {
      const r = await loescheBuergerfrage(undefined, fd);
      if (r.ok) {
        toast.success(r.message);
        onSchliessen();
      } else toast.error(r.message);
    });
  }

  const speichernDisabled =
    pending ||
    loeschPending ||
    !text.trim() ||
    (mitAntwort && redaktion.trim().length < 3);

  const speichernLabel =
    status === "antwort_eingegangen"
      ? pending
        ? "Speichere …"
        : "Speichern und freigeben"
      : pending
        ? "Speichere …"
        : "Speichern";

  return (
    <>
      <DialogHeader>
        <DialogTitle>Bürgerfrage bearbeiten</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bf-frage">Frage</Label>
          <Textarea
            id="bf-frage"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bf-kategorie">Kategorie</Label>
          <select
            id="bf-kategorie"
            value={kategorieId}
            onChange={(e) => setKategorieId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— keine —</option>
            {kategorien.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
        {mitAntwort && frage.antwort_text && (
          <div className="flex flex-col gap-2">
            <Label>Antwort der Fachstelle</Label>
            <div className="rounded-md border bg-stone-50 p-3">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {frage.antwort_text}
              </p>
              {(frage.antwort_von_name || frage.antwort_von_email) && (
                <p className="text-xs text-muted-foreground mt-2">
                  {[frage.antwort_von_name, frage.antwort_von_email]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
        )}

        {mitAntwort && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="bf-redaktion">
              {status === "freigegeben"
                ? "Freigegebene Antwort (Leitung)"
                : "FAQ-Antwort"}
            </Label>
            <Textarea
              id="bf-redaktion"
              value={redaktion}
              onChange={(e) => setRedaktion(e.target.value)}
              rows={8}
              className="bg-white"
            />
            <p className="text-xs text-muted-foreground">
              {status === "freigegeben"
                ? "Änderungen werden auch ins zugehörige FAQ übernommen."
                : "Sichtbar für Bürger:innen und Telefonist:innen."}
            </p>
          </div>
        )}
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          variant="outline"
          onClick={loeschen}
          disabled={pending || loeschPending}
          className="text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Löschen
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onSchliessen}
            disabled={pending || loeschPending}
          >
            Abbrechen
          </Button>
          <Button onClick={speichern} disabled={speichernDisabled}>
            {speichernLabel}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
