"use client";

import { useActionState } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AnimierterHaken } from "@/components/animierter-haken";
import { StatusIcon } from "@/components/status-icon";
import { FormFehler } from "@/components/form-fehler";
import { submitAntwort, type AntwortState } from "./actions";

export function AntwortForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<
    AntwortState | undefined,
    FormData
  >(submitAntwort, undefined);

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-stone-200 bg-white p-8 text-center">
        <AnimierterHaken />
        <h2 className="mt-4 text-lg font-semibold text-stone-900">
          Vielen Dank für Ihre Antwort!
        </h2>
        <p className="mt-2 max-w-sm text-sm text-stone-500">
          Ihre Antwort wurde übermittelt. Die Leitung des Bürgertelefons prüft
          sie und gibt sie an die Bürger:innen weiter. Sie können dieses Fenster
          jetzt schließen.
        </p>
      </div>
    );
  }

  // First-Answer-Wins: jemand anderes war schneller.
  // Erkennung am Substring aus der RAISE EXCEPTION in submit_fachstellen_antwort.
  if (state && !state.ok && /bereits.*beantwortet/i.test(state.message)) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-stone-200 bg-white p-8 text-center">
        <StatusIcon icon={CheckCheck} variante="neutral" />
        <h2 className="mt-1 text-lg font-semibold text-stone-900">
          Schon beantwortet
        </h2>
        <p className="mt-2 max-w-sm text-sm text-stone-500">
          Eine andere Person Ihrer Fachstelle war kurz vor Ihnen — diese
          Bürgerfrage ist bereits beantwortet, hier ist nichts weiter zu tun.
          Möchten Sie etwas ergänzen, wenden Sie sich bitte an das Bürgertelefon.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1.5">
        <Label htmlFor="antwort">Ihre Antwort</Label>
        <p className="text-xs text-muted-foreground">
          Bitte möglichst klar und verständlich, sodass die Antwort direkt
          an Bürger:innen weitergegeben werden kann.
        </p>
        <Textarea
          id="antwort"
          name="antwort"
          required
          rows={10}
          autoFocus
          placeholder="Hier die Antwort formulieren …"
          className="bg-white"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Ihr Name</Label>
          <Input
            id="name"
            name="name"
            required
            placeholder="Vorname Nachname"
            className="bg-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Ihre E-Mail-Adresse</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="vorname.nachname@ihre-behoerde.de"
            className="bg-white"
          />
          <p className="text-xs text-muted-foreground">
            Für mögliche Rückfragen der Leitung.
          </p>
        </div>
      </div>

      {state && !state.ok && <FormFehler>{state.message}</FormFehler>}

      <Button type="submit" disabled={pending} size="lg" className="w-full sm:w-auto">
        {pending ? "Speichere …" : "Antwort senden"}
      </Button>
    </form>
  );
}
