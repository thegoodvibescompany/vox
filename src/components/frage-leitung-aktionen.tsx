"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Pencil,
  Send,
  MessageSquarePlus,
  Edit3,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FrageBearbeitenDialog } from "./frage-bearbeiten-dialog";
import { AntwortManuellDialog } from "./antwort-manuell-dialog";
import {
  AnFachstelleDialog,
  type AnFachstelleVariante,
} from "./an-fachstelle-dialog";
import { freigebeBuergerfrage1zu1 } from "@/app/(app)/dashboard/actions";
import { toast } from "sonner";
import type { Buergerfrage, FrageStatus, Kategorie } from "@/lib/types";

export function FrageLeitungAktionen({
  frage,
  kategorien,
}: {
  frage: Buergerfrage;
  kategorien: Kategorie[];
}) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [antwortManuell, setAntwortManuell] = useState(false);
  const [anFachstelle, setAnFachstelle] = useState(false);
  const [fachstelleVariante, setFachstelleVariante] =
    useState<AnFachstelleVariante>("senden");
  const [freigabePending, startFreigabe] = useTransition();
  const router = useRouter();

  const status = frage.status as FrageStatus;

  function oeffneFachstelle(v: AnFachstelleVariante) {
    setFachstelleVariante(v);
    setAnFachstelle(true);
  }

  function freigeben1zu1() {
    startFreigabe(async () => {
      const r = await freigebeBuergerfrage1zu1(frage.id);
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {status === "neu" && (
          <>
            <Button size="sm" onClick={() => oeffneFachstelle("senden")}>
              <Send className="w-4 h-4 mr-1" />
              An Fachstelle senden
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAntwortManuell(true)}
            >
              <MessageSquarePlus className="w-4 h-4 mr-1" />
              Antwort manuell
            </Button>
          </>
        )}

        {status === "bei_fachstelle" && (
          <>
            <Button size="sm" onClick={() => oeffneFachstelle("senden")}>
              <Send className="w-4 h-4 mr-1" />
              Erneut senden
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAntwortManuell(true)}
            >
              <MessageSquarePlus className="w-4 h-4 mr-1" />
              Antwort manuell
            </Button>
          </>
        )}

        {status === "antwort_eingegangen" && (
          <>
            <Button size="sm" onClick={freigeben1zu1} disabled={freigabePending}>
              <Check className="w-4 h-4 mr-1" />
              {freigabePending ? "Gebe frei …" : "Freigeben"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBearbeiten(true)}
              disabled={freigabePending}
            >
              <Edit3 className="w-4 h-4 mr-1" />
              Überarbeiten und freigeben
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => oeffneFachstelle("wiederaufnahme")}
              disabled={freigabePending}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Rückfrage an Fachstelle
            </Button>
          </>
        )}

        {status !== "antwort_eingegangen" && status !== "freigegeben" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBearbeiten(true)}
            aria-label="Frage bearbeiten"
            title="Frage bearbeiten"
          >
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      </div>

      <FrageBearbeitenDialog
        frage={bearbeiten ? frage : null}
        kategorien={kategorien}
        open={bearbeiten}
        onOpenChange={setBearbeiten}
      />
      <AntwortManuellDialog
        frage={antwortManuell ? frage : null}
        open={antwortManuell}
        onOpenChange={setAntwortManuell}
      />
      <AnFachstelleDialog
        id={frage.id}
        bestehendeEmail={frage.fachstelle_email}
        variante={fachstelleVariante}
        open={anFachstelle}
        onOpenChange={setAnFachstelle}
      />
    </>
  );
}
