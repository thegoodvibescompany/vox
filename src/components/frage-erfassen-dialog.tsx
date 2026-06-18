"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  erfasseBuergerfrage,
  type DashboardActionState,
} from "@/app/(app)/dashboard/actions";

type BezugFaq = {
  id: string;
  frage: string;
  antwort: string;
};

type Props =
  | {
      // Self-Trigger-Variante: eigener Button "Bürgerfrage erfassen".
      bezugFaq?: undefined;
      open?: undefined;
      onOpenChange?: undefined;
    }
  | {
      // Controlled-Variante: wird von außen geöffnet, z. B. aus dem
      // FAQ-Detail-Dialog für eine Rückfrage zum bestehenden FAQ.
      bezugFaq: BezugFaq;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    };

export function FrageErfassenDialog(props: Props) {
  const istControlled = props.bezugFaq !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = istControlled ? props.open : internalOpen;
  const setOpen = istControlled ? props.onOpenChange : setInternalOpen;

  const [state, action, pending] = useActionState<
    DashboardActionState | undefined,
    FormData
  >(erfasseBuergerfrage, undefined);

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => setOpen(false), 300);
      return () => clearTimeout(t);
    }
  }, [state, setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!istControlled && (
        <DialogTrigger render={<Button>Bürgerfrage erfassen</Button>} />
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {istControlled ? "Rückfrage zum FAQ erfassen" : "Bürgerfrage erfassen"}
          </DialogTitle>
          <DialogDescription>
            {istControlled
              ? "Diese Rückfrage geht an die Leitung. Nach Beantwortung wird das bestehende FAQ aktualisiert."
              : "Notiere die Frage des Bürgers. Die Leitung übernimmt die Weiterleitung an die zuständige Fachstelle."}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {istControlled && (
            <>
              <input
                type="hidden"
                name="bezug_faq_id"
                value={props.bezugFaq.id}
              />
              <div className="rounded-md border bg-stone-50 p-3 text-sm">
                <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                  Bezug zum bestehenden FAQ
                </div>
                <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">
                  Frage
                </div>
                <div className="mt-0.5 font-medium text-stone-900">
                  {props.bezugFaq.frage}
                </div>
                <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">
                  Bestehende Antwort
                </div>
                <div className="mt-0.5 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed text-stone-900">
                  {props.bezugFaq.antwort}
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="frage_text">
              {istControlled ? "Rückfrage" : "Frage"}
            </Label>
            <Textarea
              id="frage_text"
              name="frage_text"
              required
              rows={5}
              placeholder={
                istControlled
                  ? "Welche Präzisierung oder Ergänzung wäre nötig?"
                  : "Was wollte die Anruferin oder der Anrufer wissen?"
              }
            />
          </div>

          {state && (
            <p
              className={`text-sm ${
                state.ok ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {state.message}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Speichere …" : istControlled ? "Rückfrage senden" : "Erfassen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
