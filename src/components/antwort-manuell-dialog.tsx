"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ergaenzeAntwortManuell } from "@/app/(app)/dashboard/actions";
import type { Buergerfrage } from "@/lib/types";

export function AntwortManuellDialog({
  frage,
  open,
  onOpenChange,
}: {
  frage: Buergerfrage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {open && frage && (
          <AntwortManuellInhalt
            key={frage.id}
            frage={frage}
            onSchliessen={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AntwortManuellInhalt({
  frage,
  onSchliessen,
}: {
  frage: Buergerfrage;
  onSchliessen: () => void;
}) {
  const [text, setText] = useState(frage.antwort_text ?? "");
  const [name, setName] = useState(frage.antwort_von_name ?? "");
  const [email, setEmail] = useState(
    frage.antwort_von_email ?? frage.fachstelle_email ?? "",
  );
  const [pending, setPending] = useState(false);

  async function speichern() {
    setPending(true);
    const r = await ergaenzeAntwortManuell({
      id: frage.id,
      antwort_text: text,
      antwort_von_name: name.trim() || null,
      antwort_von_email: email.trim() || null,
    });
    setPending(false);
    if (r.ok) {
      toast.success(r.message);
      onSchliessen();
    } else toast.error(r.message);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Antwort manuell eintragen</DialogTitle>
        <DialogDescription>
          Wenn die Fachstelle telefonisch oder außerhalb des Tokens geantwortet hat.
          Die Antwort landet im Status „eingegangen“ und muss anschließend freigegeben werden.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label>Frage</Label>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {frage.frage_text}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="am-text">Antwort</Label>
          <Textarea
            id="am-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="am-name">Name der Fachstelle</Label>
            <Input
              id="am-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maria Müller, SG 34"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="am-email">E-Mail (optional)</Label>
            <Input
              id="am-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="fachstelle@ihre-behoerde.de"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onSchliessen} disabled={pending}>
          Abbrechen
        </Button>
        <Button
          onClick={speichern}
          disabled={
            pending || text.trim().length < 3 || name.trim().length < 2
          }
        >
          {pending ? "Speichere …" : "Eintragen"}
        </Button>
      </DialogFooter>
    </>
  );
}
