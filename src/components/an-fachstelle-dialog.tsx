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
import {
  sendeAnFachstelle,
  erneutAnFachstelle,
  type DashboardActionState,
} from "@/app/(app)/dashboard/actions";

// "senden" = Erstversand bzw. Erneut-Senden vor Antwort (Multi-Mail möglich).
// "wiederaufnahme" = Anfrage war bereits beantwortet, Antwort wird verworfen
// und mit Rückfrage erneut an die Fachstelle geschickt (single-mail).
export type AnFachstelleVariante = "senden" | "wiederaufnahme";

export function AnFachstelleDialog({
  id,
  bestehendeEmail,
  variante = "senden",
  open,
  onOpenChange,
}: {
  id: string;
  bestehendeEmail: string | null;
  variante?: AnFachstelleVariante;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {open && (
          <Inhalt
            id={id}
            bestehendeEmail={bestehendeEmail}
            variante={variante}
            onSchliessen={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Inhalt({
  id,
  bestehendeEmail,
  variante,
  onSchliessen,
}: {
  id: string;
  bestehendeEmail: string | null;
  variante: AnFachstelleVariante;
  onSchliessen: () => void;
}) {
  const [emails, setEmails] = useState(bestehendeEmail ?? "");
  const [rueckfrage, setRueckfrage] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DashboardActionState | null>(null);

  const istWiederaufnahme = variante === "wiederaufnahme";

  async function senden() {
    setPending(true);
    let r: DashboardActionState;
    if (istWiederaufnahme) {
      const neueEmail = emails.trim();
      r = await erneutAnFachstelle({
        id,
        rueckfrage: rueckfrage.trim(),
        neue_email:
          neueEmail && neueEmail !== (bestehendeEmail ?? "")
            ? neueEmail
            : null,
      });
    } else {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("empfaenger_emails", emails.trim());
      r = await sendeAnFachstelle(undefined, fd);
    }
    setPending(false);
    if (r.ok) {
      // Die App hat die Mail selbst verschickt — kurze Bestätigung, schließen.
      toast.success(r.message);
      onSchliessen();
      return;
    }
    setResult(r);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {istWiederaufnahme ? "Rückfrage an Fachstelle" : "An Fachstelle senden"}
        </DialogTitle>
        <DialogDescription>
          {istWiederaufnahme
            ? "Die bisherige Antwort bleibt als Schriftwechsel erhalten. Formuliere deine Rückfrage; die Fachstelle sieht den bisherigen Verlauf und antwortet darauf. Der Status springt zurück auf 'bei Fachstelle' und es entsteht ein neuer Antwort-Link (7 Tage gültig)."
            : "Eine oder mehrere E-Mail-Adressen der zuständigen Fachstelle eingeben. Bei mehreren Empfängern entsteht eine gemeinsame E-Mail mit allen Adressen im Empfängerfeld und ein gemeinsamer Antwort-Link (7 Tage gültig). Die zuerst eingehende Antwort wird übernommen."}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {istWiederaufnahme && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="rueckfrage-text">Deine Rückfrage</Label>
            <Textarea
              id="rueckfrage-text"
              value={rueckfrage}
              onChange={(e) => setRueckfrage(e.target.value)}
              placeholder="Was soll die Fachstelle ergänzen oder präzisieren?"
              rows={4}
              autoFocus
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="fachstelle-email">
            {istWiederaufnahme ? "Fachstellen-E-Mail" : "Fachstellen-E-Mails"}
          </Label>
          {istWiederaufnahme ? (
            <Input
              id="fachstelle-email"
              type="email"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="fachstelle@ihre-behoerde.de"
            />
          ) : (
            <>
              <Textarea
                id="fachstelle-email"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder={"fachstelle@ihre-behoerde.de\nweitere@ihre-behoerde.de"}
                rows={3}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Pro Zeile oder per Komma/Semikolon getrennt. Die erste Adresse
                wird als primäre Fachstelle in der Anfrage gespeichert.
              </p>
            </>
          )}
          {bestehendeEmail && bestehendeEmail !== emails.trim() && (
            <p className="text-xs text-muted-foreground">
              Bisher: {bestehendeEmail}
            </p>
          )}
        </div>
        {result && !result.ok && (
          <p className="text-sm text-red-700">{result.message}</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onSchliessen} disabled={pending}>
          Abbrechen
        </Button>
        <Button
          onClick={senden}
          disabled={
            pending ||
            !emails.includes("@") ||
            (istWiederaufnahme && rueckfrage.trim().length < 5)
          }
        >
          {pending
            ? "Sende …"
            : istWiederaufnahme
              ? "Rückfrage senden"
              : "An Fachstelle senden"}
        </Button>
      </DialogFooter>
    </>
  );
}

